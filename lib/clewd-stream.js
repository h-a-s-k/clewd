/*
* https://gitgud.io/ahsk/clewd
* https://github.com/h-a-s-k/clewd
*/
'use strict';

const {AI, genericFixes, DangerChars, encodeDataJSON, indexOfAny, cleanJSON} = require('./clewd-utils'), Decoder = new TextDecoder;

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
        this.#version = opts.version;
        this.#config = opts.config;
        this.#modelName = opts.modelName || AI.mdl();
        this.#streaming = opts.streaming || false;
        this.#minSize = opts.minSize || 8;
        this.#abortControl = opts.abortControl;
        this.#sourceStream = opts.sourceStream;
    }
    #sourceStream=void 0;
    #sourceStreamComplete=false;
    #streaming=void 0;
    #minSize=void 0;
    #compOK='';
    #compRaw='';
    #logger=void 0;
    #version=void 0;
    #config=void 0;
    #abortControl=void 0;
    #modelName=void 0;
    #compAll=[];
    #recvLength=0;
    #stopLoc=void 0;
    #stopReason=void 0;
    #hardCensor=false;
    #impersonated=false;
    #cookiechange=false;
    #readonly=false;
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
    get cookiechange() {
        return this.#cookiechange;
    }
    get readonly() {
        return this.#readonly;
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
    #build(selection) {
        this.#logger?.write(selection);
        const completion = this.#streaming ? {
            choices: [ {
                delta: {
                    content: genericFixes(selection)
                }
            } ]
        } : {
            choices: [ {
                message: {
                    content: genericFixes(selection)
                }
            } ]
        };
        return this.#streaming ? encodeDataJSON(completion) : JSON.stringify(completion);
    }
    #print() {}
    #done(controller) {
        this.#print();
        this.#compRaw.length > 0 && this.#parseBuf(this.#compRaw, controller);
        if (!this.#sourceStreamComplete) {
            this.#endSuperfetch();
            this.#streaming ? this.#compOK.length > 0 && controller.enqueue(this.#build(this.#compOK)) : controller.enqueue(this.#build(this.#compAll.join('')));
            330 === this.#recvLength && (this.#hardCensor = true);
            if (this.total < 1) {
                const err = `## ${this.#version}\n**error**:\n\n\`\`\`Received no valid replies at all\`\`\``;
                controller.enqueue(this.#build(err));
            }
            this.#streaming && controller.enqueue('data: [DONE]\n\n');
        }
    }
    #endSuperfetch() {
        if (this.#config.Settings.Superfetch) {
            this.#sourceStream?.stdout?.end();
            this.#sourceStream?.stderr?.end();
            this.#sourceStream?.kill('SIGKILL');
            this.#sourceStreamComplete = true;
        }
    }
    #impersonationCheck(reply, controller) {
        const fakeAny = indexOfAny(reply);
        if (fakeAny > -1) {
            this.#impersonated = true;
            if (this.#config.Settings.PreventImperson) {
                const selection = reply.substring(0, fakeAny);
                controller.enqueue(this.#build(selection));
                this.#streaming && controller.enqueue('data: [DONE]\n\n');
                this.#print();
                this.#abortControl.abort();
                this.#endSuperfetch();
                return controller.terminate();
            }
        }
    }
    #handle(chunk, controller) {
        if (this.#sourceStreamComplete) {
            return;
        }
        if ('string' != typeof chunk) {
            this.#recvLength += chunk.byteLength;
            chunk = Decoder.decode(chunk);
        } else {
            this.#recvLength += Buffer.byteLength(chunk);
        }
        chunk = cleanJSON(chunk);
        this.#compRaw += chunk;
        const substr = this.#compRaw.split('\n'), lastMsg = substr.length - 1;
        0 !== substr[lastMsg].length ? this.#compRaw = substr[lastMsg] : this.#compRaw = '';
        for (let i = 0; i < lastMsg; i++) {
            this.#parseBuf(substr[i], controller);
        }
    }
    #parseBuf(json, controller) {
        if (!json) {
            return;
        }
        if (this.#sourceStreamComplete) {
            return;
        }
        let parsed, delayChunk;
        try {
            parsed = JSON.parse(json);
/******************************** */ 
            //parsed.error && (parsed.completion = `## ${this.#version}\n**${AI.end()} error**:\n\n\`\`\`${JSON.stringify(parsed.error, null, 4)}\`\`\``);
            if (parsed.error) {
                parsed.completion = `## ${this.#version}\n**${AI.end()} error**:\n\n\`\`\`${JSON.stringify(parsed.error, null, 4)}\`\`\``;
                if (parsed.completion.includes('read-only mode')) {
                    this.#cookiechange = true;
                    this.#readonly = true;
                }
                else if (parsed.completion.includes('Exceeded completions limit')) {
                    this.#cookiechange = true;
                }
            }
/******************************** */ 
            if (parsed.completion) {
                parsed.completion = genericFixes(parsed.completion);
                this.#compOK += parsed.completion;
                this.#compAll.push(parsed.completion);
                delayChunk = DangerChars.some((char => this.#compOK.endsWith(char) || parsed.completion.startsWith(char)));
            }
            !this.#stopLoc && parsed.stop && (this.#stopLoc = parsed.stop.replace(/\n/g, '\\n'));
            !this.#stopReason && parsed.stop_reason && (this.#stopReason = parsed.stop_reason);
            if (this.#streaming) {
                delayChunk && this.#impersonationCheck(this.#compOK, controller);
                for (;!delayChunk && this.#compOK.length >= this.#minSize; ) {
                    const selection = this.#collectBuf();
                    controller.enqueue(this.#build(selection));
                }
            } else {
                delayChunk && this.#impersonationCheck(this.#compAll.join(''), controller);
            }
        } catch (err) {}
    }
}

module.exports = ClewdStream;