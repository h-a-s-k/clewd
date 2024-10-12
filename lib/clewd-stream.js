/*
* https://gitgud.io/ahsk/clewd
* https://github.com/h-a-s-k/clewd
*/
'use strict';

const {Main, AI, genericFixes, encodeDataJSON, indexOfAny, parseEvent, checkResErr} = require('./clewd-utils'), {DangerChars} = require('./clewd-message'), Decoder = new TextDecoder;

class ClewdStream extends TransformStream {
    constructor(opts, logger) {
        super({
            transform: (chunk, controller) => {
                this.#handle(chunk, controller);
            },
            flush: controller => {
                this.#done(controller);
            }
        });
        this.#logger = logger;
        this.#config = opts.config;
        this.#model = opts.model;
        this.#streaming = opts.streaming;
        this.#minSize = opts.minSize || 8;
        this.#abortControl = opts.abortControl;
        this.#source = opts.source;
    }
    #source=void 0;
    #started=Math.round(Date.now() / 1e3);
    #ended=false;
    #streaming=void 0;
    #minSize=void 0;
    #compOK='';
    #compRaw='';
    #logger=void 0;
    #config=void 0;
    #abortControl=void 0;
    #model=void 0;
    #compAll=[];
    #recvLength=0;
    #hardCensor=false;
    #impersonated=false;
    #stopLoc=null;
    #stopReason=null;
    #remainingCompletions=Infinity;
    get size() {
        return this.#recvLength;
    }
    get total() {
        return this.#compAll.length;
    }
    get censored() {
        return this.#hardCensor;
    }
    get impersonated() {
        return this.#impersonated;
    }
    get remaining() {
        return this.#remainingCompletions;
    }
    empty() {
        this.#compOK = this.#compRaw = '';
        this.#compAll = [];
        this.#recvLength = 0;
    }
    #collectBuf() {
        const valid = [ ...this.#compOK ], selection = valid.splice(0, Math.min(this.#minSize, valid.length)).join('');
        this.#compOK = valid.join('');
        return selection;
    }
    #err(err, controller) {
        this.#logger?.write(JSON.stringify(err, null, 4));
        const message = `## ${Main}\n**${this.#model} error**:\n${err.status || err.code || err.type}\n\n\`\`\`${err.message}\`\`\``;
        this.#enqueue(this.#build(message), controller);
        return this.#endEarly(controller, err);
    }
    #build(selection) {
        this.#logger?.write(selection);
        let completion = {
            id: 'chatcmpl-' + this.total,
            object: this.#streaming ? 'chat.completion.chunk' : 'chat.completion',
            created: 0,
            model: this.model,
            system_fingerprint: 'fp_clewd'
        };
        this.#streaming ? completion.choices = [ {
            index: 0,
            delta: {
                content: genericFixes(selection)
            },
            logprobs: null,
            finish_reason: this.#stopReason
        } ] : completion.choices = [ {
            index: 0,
            message: {
                content: genericFixes(selection)
            },
            logprobs: null,
            finish_reason: this.#stopReason
        } ];
        return this.#streaming ? encodeDataJSON(completion) : JSON.stringify(completion);
    }
    #enqueue(selection, controller) {
        this.#ended || controller.enqueue(selection);
    }
    #print() {}
    async #done(controller) {
        this.#compRaw.length > 0 && await this.#parseBuf(this.#compRaw, controller);
        this.#streaming ? this.#compOK.length > 0 && this.#enqueue(this.#build(this.#compOK), controller) : this.#enqueue(this.#build(this.#compAll.join('')), controller);
        this.#compAll?.[0] === Buffer.from([ 73, 32, 97, 112, 111, 108, 111, 103, 105, 122, 101, 44, 32, 98, 117, 116, 32, 73, 32, 119, 105, 108, 108, 32, 110, 111, 116, 32, 112, 114, 111, 118, 105, 100, 101, 32, 97, 110, 121, 32, 114, 101, 115, 112, 111, 110, 115, 101, 115, 32, 116, 104, 97, 116, 32, 118, 105, 111, 108, 97, 116, 101, 32, 65, 110, 116, 104, 114, 111, 112, 105, 99, 39, 115, 32, 65, 99, 99, 101, 112, 116, 97, 98, 108, 101, 32, 85, 115, 101, 32, 80, 111, 108, 105, 99, 121, 32, 111, 114, 32, 99, 111, 117, 108, 100, 32, 112, 114, 111, 109, 111, 116, 101, 32, 104, 97, 114, 109, 46 ]).toString() && (this.#hardCensor = true);
        if (!this.#ended && 0 === this.total) {
            const err = `## ${Main}\n**error**:\n\n\`\`\`Received no valid replies at all\`\`\``;
            this.#enqueue(this.#build(err), controller);
        }
        this.#streaming && this.#enqueue('data: [DONE]\n\n', controller);
        this.#print();
        this.#ended = true;
    }
    #endEarly(controller, err = null) {
        if (!this.#ended) {
            this.#streaming && this.#enqueue('data: [DONE]\n\n', controller);
            this.#abortControl.abort(err?.message || 'Ending early');
            this.#config.Settings.Superfetch && this.#source.rape();
            controller.terminate();
            this.#print();
            this.#ended = true;
        }
    }
    #impersonationCheck(reply, controller) {
        const fakeAny = indexOfAny(reply);
        if (fakeAny > -1) {
            this.#impersonated = true;
            if (this.#config.Settings.PreventImperson) {
                const selection = reply.substring(0, fakeAny);
                this.#enqueue(this.#build(selection), controller);
                const err = Error('Impersonation');
                this.#endEarly(controller, err);
            }
        }
    }
    async #handle(chunk, controller) {
        if ('string' != typeof chunk) {
            this.#recvLength += chunk.byteLength;
            chunk = Decoder.decode(chunk);
        } else {
            this.#recvLength += Buffer.byteLength(chunk);
        }
        this.#compRaw += chunk;
        const substr = this.#compRaw.split('\n\n'), lastMsg = substr.length - 1;
        0 !== substr[lastMsg].length ? this.#compRaw = substr[lastMsg] : this.#compRaw = '';
        for (let i = 0; i < lastMsg; i++) {
            await this.#parseBuf(substr[i], controller);
        }
    }
    async #parseBuf(event, controller) {
        if (!event) {
            return;
        }
        if (this.#ended) {
            return;
        }
        let parsed, delayChunk;
        try {
            const {eventType, eventData} = parseEvent(event);
            if (![ 'raw', 'completion' ].includes(eventType)) {
                throw Error('Unhandled event');
            }
            parsed = JSON.parse(eventData);
            parsed.messageLimit?.remaining && (this.#remainingCompletions = parsed.messageLimit.remaining);
            if (parsed.error) {
                const err = await checkResErr(JSON.stringify({
                    error: {
                        ...parsed.error
                    },
                    status: this.#source.status,
                    superfetch: this.#source.superfetch
                }), false);
                delete err.stack;
                return this.#err(err, controller);
            }
            if (parsed.completion) {
                parsed.completion = genericFixes(parsed.completion);
                this.#compOK += parsed.completion;
                this.#compAll.push(parsed.completion);
                delayChunk = !!this.#config.Settings.PreventImperson && DangerChars.some((char => this.#compOK.endsWith(char) || parsed.completion.startsWith(char)));
            }
            !this.#stopLoc && parsed.stop && (this.#stopLoc = parsed.stop.replace(/\n/g, '\\n'));
            !this.#stopReason && parsed.stop_reason && (this.#stopReason = parsed.stop_reason);
            if (this.#streaming) {
                delayChunk && this.#impersonationCheck(this.#compOK, controller);
                for (;!delayChunk && this.#compOK.length >= this.#minSize; ) {
                    const selection = this.#collectBuf();
                    this.#enqueue(this.#build(selection), controller);
                }
            } else {
                delayChunk && this.#impersonationCheck(this.#compAll.join(''), controller);
            }
        } catch (err) {}
    }
}

module.exports = ClewdStream;