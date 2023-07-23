/**
 * SET YOUR COOKIE HERE
 * @preserve
 */
const Cookie = '';

/**
## EXPERIMENTAL

### SettingName: (DEFAULT)/opt1/opt2

 1. AdaptClaude: (false)/true
    * true tries to make human/assistant prompts uniform between endpoints
    * effective both with streaming on and off now
    * __true *might* be bad for jailbreaks__, as no Assistant/Human is sent and it might be seen as sample dialogue instead of a direct order [see this](https://docs.anthropic.com/claude/docs/prompt-troubleshooting-checklist#the-prompt-is-formatted-correctly)
    - Human->H
    - Human<-H
    - Assistant->A
    - Assistant<-A

 2. AntiStall: (false)/1/2
    * 1/2 has no effect when using streaming
    * 1 sends whatever was last when exceeding size (might have some spicy things but impersonations as well)
    * 2 sends a usable message where the bot actually stopped talking

 3. ClearFlags: (false)/true
    * possibly snake-oil

 4. DeleteChats: (false)/true
    * true is for privacy, auto deletes your conversations after each reply
    * **if set to true, will also wipe old conversations on startup!**
    * no effect if RetryRegenerate is set to true

 5. PassParams: (false)/true
    * true will send the temperature you set on your frontent
    * only values under <=1
    * this could get your account banned
    * if clewd stops working, set to false

 6. PreventImperson: (false)/true
    * true trims the bot reply immediately if he says "Human:" or "H:"
    * making it so it doesn't hallucinate speaking as you __(chance of missing some spicy things)__
    * it's probable this will trigger before AntiStall if you have that on

 7. PromptExperiment: (true)/false
    * true is an alternative way to send your prompt to the AI
    * experiment before setting to false

 8. RecycleChats: (false)/true
    * true reuses the same chat on the website, based on the first prompt
    * false is less likely to get caught in a censorship loop

 9. RetryRegenerate: (false)/true
    * true uses the AI's own retry mechanism when you regenerate on your frontend
    * instead of a new conversation
    * experiment with it

 10. StripAssistant: (false)/true
    * true might be good IF your prompt/jailbreak itself ends with Assistant: 

 11. StripHuman: (false)/true
    * true is a bad idea without RecycleChats, sends only your very last message

 * @preserve
 */
const Settings = {
    AdaptClaude: false,
    AntiStall: 1,
    ClearFlags: false,
    DeleteChats: false,
    PassParams: false,
    PreventImperson: false,
    PromptExperiment: true,
    RecycleChats: false,
    RetryRegenerate: false,
    StripAssistant: false,
    StripHuman: false
};

const Ip = '127.0.0.1';
const Port = 8444;

/**
 * Don't touch StallTriggerMax.
 * If you know what you're doing, change the 1.5 MB on StallTrigger to what you want
 * @preserve
 */
const StallTriggerMax = 4194304;
const StallTrigger = 1572864;

/**
 * How much will be buffered before one stream chunk goes through
 * lower = less chance of AdaptClaude working properly
 * @default 25
 * @preserve
 */
const BufferSize = 25;

const {createServer: Server, IncomingMessage: IncomingMessage, ServerResponse: ServerResponse} = require('node:http');
const {createHash: Hash, randomUUID: randomUUID, randomInt: randomInt, randomBytes: randomBytes} = require('node:crypto');
const {TransformStream: TransformStream} = require('node:stream/web');
const {Writable: Writable} = require('node:stream');

const Decoder = new TextDecoder;
const Encoder = new TextEncoder;

const Assistant = '\n\nAssistant: ';
const Human = '\n\nHuman: ';

const A = '\n\nA: ';
const H = '\n\nH: ';

const cookies = {};
const UUIDMap = {};

let uuidTemp;
let uuidOrg;

let lastPrompt;

ServerResponse.prototype.json = function(body, statusCode = 200, headers) {
    this.headersSent || this.writeHead(statusCode, {
        'Content-Type': 'application/json',
        ...headers && headers
    });
    this.end('object' == typeof body ? JSON.stringify(body) : body);
    return this;
};

const AI = {
    endPoint: () => Buffer.from([ 104, 116, 116, 112, 115, 58, 47, 47, 99, 108, 97, 117, 100, 101, 46, 97, 105 ]).toString(),
    modelA: () => Buffer.from([ 99, 108, 97, 117, 100, 101, 45, 50 ]).toString(),
    modelB: () => Buffer.from([ 99, 108, 97, 117, 100, 101, 45, 105, 110, 115, 116, 97, 110, 116, 45, 49 ]).toString(),
    agent: () => Buffer.from([ 77, 111, 122, 105, 108, 108, 97, 47, 53, 46, 48, 32, 40, 87, 105, 110, 100, 111, 119, 115, 32, 78, 84, 32, 49, 48, 46, 48, 59, 32, 87, 105, 110, 54, 52, 59, 32, 120, 54, 52, 41, 32, 65, 112, 112, 108, 101, 87, 101, 98, 75, 105, 116, 47, 53, 51, 55, 46, 51, 54, 32, 40, 75, 72, 84, 77, 76, 44, 32, 108, 105, 107, 101, 32, 71, 101, 99, 107, 111, 41, 32, 67, 104, 114, 111, 109, 101, 47, 49, 49, 52, 46, 48, 46, 48, 46, 48, 32, 83, 97, 102, 97, 114, 105, 47, 53, 51, 55, 46, 51, 54, 32, 69, 100, 103, 47, 49, 49, 52, 46, 48, 46, 49, 56, 50, 51, 46, 55, 57 ]).toString()
};

const fileName = () => {
    const bytes = randomInt(5, 15);
    return randomBytes(bytes).toString('hex') + '.txt';
};

const indexOfH = (text, last = false) => {
    let location = -1;
    const matchesH = text.match(/[\n]{1,}(Human|H):[\s]*?/gm);
    matchesH?.length > 0 && (location = last ? text.lastIndexOf(matchesH[matchesH.length - 1]) : text.indexOf(matchesH[0]));
    return location;
};

const indexOfA = (text, last = false) => {
    let location = -1;
    const matchesA = text.match(/[\n]{1,}(Assistant|A):[\s]*?/gm);
    matchesA?.length > 0 && (location = last ? text.lastIndexOf(matchesA[matchesA.length - 1]) : text.indexOf(matchesA[0]));
    return location;
};

const cleanJSON = json => json.replace(/^data: {/gi, '{').replace(/\s+$/gi, '');

const stallProtected = () => [ '1', '2' ].includes(Settings.AntiStall + '');

const adaptClaude = (text, direction = 'outgoing') => {
    text = text.replace(/(\r\n|\r|\\n)/gm, '\n');
    if (!Settings.AdaptClaude) {
        return text;
    }
    const replacers = {
        outgoing: {
            H: [ /(\n{2,}Human: )/gm, H ],
            A: [ /(\n{2,}Assistant: )/gm, A ]
        },
        incoming: {
            H: [ /(\n{2,}H: )/gm, Human ],
            A: [ /(\n{2,}A: )/gm, Assistant ]
        }
    };
    return replacers[direction].H[0].test(text) || replacers[direction].A[0].test(text) ? text.replace(replacers[direction].H[0], replacers[direction].H[1]).replace(replacers[direction].A[0], replacers[direction].A[1]) : text;
};

const updateCookies = cookieInfo => {
    let cookieNew = cookieInfo instanceof Response ? cookieInfo.headers?.get('set-cookie') : cookieInfo.split('\n').join('');
    if (!cookieNew) {
        return;
    }
    let cookieArr = cookieNew.split(/;\s?/gi).filter((prop => false === /^(path|expires|domain|HttpOnly|Secure|SameSite)[=;]*/i.test(prop)));
    for (const cookie of cookieArr) {
        const divide = cookie.split(/^(.*?)=\s*(.*)/);
        const cookieName = divide[1];
        const cookieVal = divide[2];
        cookies[cookieName] = cookieVal;
    }
};

const getCookies = () => Object.keys(cookies).map((name => `${name}=${cookies[name]};`)).join(' ').replace(/(\s+)$/gi, '');

const deleteChat = async uuid => {
    const res = await fetch(`${AI.endPoint()}/api/organizations/${uuidOrg}/chat_conversations/${uuid}`, {
        headers: {
            Cookie: getCookies(),
            'Content-Type': 'application/json'
        },
        method: 'DELETE'
    });
    updateCookies(res);
};

const setTitle = title => {
    title = 'clewd v2.5 - ' + title;
    process.title !== title && (process.title = title);
};

class ClewdStream extends TransformStream {
    constructor(minSize = 25, modelName = AI.modelA(), streaming) {
        super({
            transform: (chunk, controller) => {
                this.#handle(chunk, controller);
            },
            flush: controller => {
                this.#done(controller);
            }
        });
        this.#modelName = modelName;
        this.#minSize = minSize;
        this.#streaming = streaming;
    }
    #compLast='';
    #minSize=15;
    #streaming=false;
    #compPure='';
    #modelName='';
    #compAll=[];
    #compValid=[];
    #compInvalid=[];
    #recvLength=0;
    #stopLoc=null;
    #stopReason=null;
    #hardCensor=false;
    get size() {
        return this.#recvLength;
    }
    get valid() {
        return this.#compValid.length;
    }
    get invalid() {
        return this.#compInvalid.length;
    }
    get total() {
        return this.valid + this.invalid;
    }
    get broken() {
        return (this.invalid / this.total * 100).toFixed(2) + '%';
    }
    get censored() {
        return this.#hardCensor;
    }
    get stalled() {
        return stallProtected() && this.#recvLength >= StallTrigger;
    }
    empty() {
        this.#compPure = this.#compLast = this.#compAll = this.#compValid = this.#compInvalid = null;
    }
    #cutBuffer(cutoff) {
        let compCut;
        if (this.#streaming) {
            compCut = this.#compPure.substring(0, cutoff);
            this.#compPure = this.#compPure.substring(cutoff, this.#compPure.length);
        } else {
            compCut = this.#compLast.substring(0, cutoff);
        }
        return compCut;
    }
    #build(cutoff) {
        const completion = this.#cutBuffer(cutoff);
        const builtReply = JSON.stringify({
            completion: adaptClaude(completion, 'incoming'),
            stop_reason: this.#stopReason,
            model: this.modelName,
            stop: this.#stopLoc,
            log_id: '',
            messageLimit: {
                type: 'within_limit'
            }
        });
        return this.#streaming ? Encoder.encode(`data: ${builtReply}\n\n`) : builtReply;
    }
    #print() {}
    #done(controller) {
        this.#print();
        330 === this.#recvLength && (this.#hardCensor = true);
        this.#streaming ? this.#compPure.length > 0 && controller.enqueue(this.#build(this.#compPure.length)) : controller.enqueue(this.#build(this.#compLast.length));
    }
    #stallCheck(controller) {
        if (!this.stalled || this.#streaming) {
            return;
        }
        const triggerEmergency = this.#recvLength >= Math.max(StallTriggerMax, 2 * StallTrigger);
        if (Settings.AntiStall + '' == '1' || triggerEmergency) {
            console.log(`[31mstall: ${triggerEmergency ? 'max' : '1'}[0m`);
            controller.enqueue(this.#build(this.#compLast.length));
            return controller.terminate();
        }
        const validCompletion = this.#compAll.find((completion => completion.indexOf(H) > -1 || completion.indexOf(Human) > -1));
        if (validCompletion) {
            this.#compLast = validCompletion;
            const fakeHuman = indexOfH(validCompletion);
            console.log('[31mstall: 2[0m');
            controller.enqueue(this.#build(fakeHuman > -1 ? fakeHuman : validCompletion.length));
            return controller.terminate();
        }
    }
    #impersonationCheck(controller, completion) {
        if (!Settings.PreventImperson) {
            return;
        }
        let cutLimit = completion.length;
        const fakeHuman = indexOfH(completion);
        if (fakeHuman > -1) {
            cutLimit = fakeHuman;
            this.#print();
            console.log(`[33mimpersonation, dropped:[0m [4m${completion.substring(cutLimit, completion.length).split('\n').join(' ')}[0m`);
            controller.enqueue(this.#build(cutLimit));
            return controller.terminate();
        }
    }
    #handle(chunk, controller) {
        let completion;
        this.#recvLength += chunk.length || 0;
        chunk = Decoder.decode(chunk);
        chunk = cleanJSON(chunk);
        try {
            const clean = cleanJSON(chunk);
            const parsed = JSON.parse(clean);
            completion = parsed.completion;
            this.#stopLoc = parsed.stop;
            this.#stopReason = parsed.stop_reason;
            this.#compValid.push(completion);
        } catch (err) {
            const {stopMatch: stopMatch, stopReasonMatch: stopReasonMatch, completionMatch: completionMatch} = (chunk => ({
                completionMatch: (chunk = 'string' == typeof chunk ? chunk : Decoder.decode(chunk)).match(/(?<="completion"\s?:\s?")(.*?)(?=\\?",?)/gi),
                stopMatch: chunk.match(/(?<="stop"\s?:\s?")(.*?)(?=\\?",?)/gi),
                stopReasonMatch: chunk.match(/(?<="stop_reason"\s?:\s?")(.*?)(?=\\?",?)/gi)
            }))(chunk);
            stopMatch && (this.#stopLoc = stopMatch.join(''));
            stopReasonMatch && (this.#stopReason = stopReasonMatch.join(''));
            if (completionMatch) {
                completion = completionMatch.join('');
                this.#compInvalid.push(completion);
            }
        } finally {
            if (!completion) {
                return;
            }
            this.#compAll.push(completion);
            if (this.#streaming) {
                this.#compPure += completion;
                this.#impersonationCheck(controller, this.#compPure);
                for (;this.#compPure.length >= this.#minSize; ) {
                    controller.enqueue(this.#build(this.#compPure.length));
                }
            } else {
                this.#compLast = completion;
                this.#stallCheck(controller);
                this.#impersonationCheck(controller, this.#compLast);
            }
        }
    }
}

const Proxy = Server(((req, res) => {
    if ('/v1/complete' !== req.url) {
        return res.json({
            error: {
                message: '404 Not Found',
                type: 404,
                param: null,
                code: 404
            }
        }, 404);
    }
    setTitle('recv...');
    let fetchAPI;
    const controller = new AbortController;
    const {signal: signal} = controller;
    res.socket.on('close', (async () => {
        controller.signal.aborted || controller.abort();
    }));
    const buffer = [];
    req.on('data', (chunk => {
        buffer.push(chunk);
    }));
    req.on('end', (async () => {
        let titleTimer;
        let promptSHA;
        try {
            const body = JSON.parse(Buffer.concat(buffer).toString());
            const attachments = [];
            const temperature = Math.max(0, Math.min(1, body.temperature));
            let {prompt: prompt} = body;
            const retryingMessage = Settings.RetryRegenerate && prompt === lastPrompt;
            retryingMessage || (lastPrompt = prompt);
            if (!body.stream && prompt === `${Human}${Human}Hi${Assistant}`) {
                return res.json({
                    error: false
                });
            }
            const model = /claude-v?2.*/.test(body.model) ? AI.modelA() : body.model;
            model !== AI.modelA() && console.log(`[33mmodel[0m [1m${AI.modelA()}[0m [33mrecommended[0m`);
            stallProtected() || body.stream || Settings.PreventImperson || console.log('[33mhaving[0m [1mPreventImperson[0m: true or [1mAntiStall[0m [33m: 1/2 is good when not streaming[0m');
            const firstAssistantIdx = indexOfA(prompt);
            const lastAssistantIdx = indexOfA(prompt, true);
            const lastHumanIdx = indexOfH(prompt, true);
            /**
             * Ideally SillyTavern would expose a unique frontend conversation_uuid prop to localhost proxies
             * could set the name to a hash of it
             * then fetch /chat_conversations with 'GET' and find it
             * @preserve
             */            const hash = Hash('sha1');
            hash.update(prompt.substring(0, firstAssistantIdx));
            promptSHA = Settings.RecycleChats ? hash.digest('hex') : '';
            const uuidOld = UUIDMap[promptSHA];
            Settings.StripHuman && lastHumanIdx > -1 && uuidOld && (prompt = prompt.substring(lastHumanIdx, prompt.length));
            Settings.StripAssistant && lastAssistantIdx > -1 && (prompt = prompt.substring(0, lastAssistantIdx));
            prompt = adaptClaude(prompt, 'outgoing');
            if (Settings.PromptExperiment && !retryingMessage) {
                attachments.push({
                    extracted_content: prompt,
                    file_name: fileName(),
                    file_size: Buffer.from(prompt).length,
                    file_type: 'text/plain'
                });
                prompt = '';
            }
            if (!uuidOld && Settings.RecycleChats || !retryingMessage) {
                uuidTemp = randomUUID().toString();
                fetchAPI = await fetch(`${AI.endPoint()}/api/organizations/${uuidOrg}/chat_conversations`, {
                    signal: signal,
                    headers: {
                        Cookie: getCookies(),
                        'Content-Type': 'application/json'
                    },
                    method: 'POST',
                    body: JSON.stringify({
                        uuid: uuidTemp,
                        name: promptSHA
                    })
                });
                updateCookies(fetchAPI);
                console.log('' + model);
                UUIDMap[promptSHA] = uuidTemp;
            } else {
                uuidTemp = uuidOld;
                retryingMessage && Settings.RecycleChats ? console.log(model + ' [rR]') : retryingMessage ? console.log(model + ' [r]') : Settings.RecycleChats ? console.log(model + ' [R]') : console.log('' + model);
            }
            fetchAPI = await fetch(`${AI.endPoint()}${retryingMessage ? '/api/retry_message' : '/api/append_message'}`, {
                signal: signal,
                headers: {
                    Cookie: getCookies(),
                    'Content-Type': 'application/json'
                },
                method: 'POST',
                body: JSON.stringify({
                    completion: {
                        ...Settings.PassParams && {
                            temperature: temperature
                        },
                        incremental: true === body.stream,
                        prompt: prompt,
                        timezone: 'America/New_York',
                        model: model
                    },
                    organization_uuid: uuidOrg,
                    conversation_uuid: uuidTemp,
                    text: prompt,
                    attachments: attachments
                })
            });
            updateCookies(fetchAPI);
            const response = Writable.toWeb(res);
            if (200 !== fetchAPI.status) {
                return fetchAPI.body.pipeTo(response);
            }
            const clewdStream = new ClewdStream(BufferSize, model, true === body.stream);
            titleTimer = setInterval((() => setTitle(`recv${true === body.stream ? ' (s)' : ''} ${((bytes = 0) => {
                const b = [ 'B', 'KB', 'MB', 'GB', 'TB' ];
                if (0 === bytes) {
                    return '0 B';
                }
                const c = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), 4);
                return 0 === c ? `${bytes} ${b[c]}` : `${(bytes / 1024 ** c).toFixed(1)} ${b[c]}`;
            })(clewdStream.size)}`)), 300);
            await fetchAPI.body.pipeThrough(clewdStream).pipeTo(response);
            clewdStream.censored && console.log('[33mlikely your account is hard-censored[0m');
            console.log(`${200 == fetchAPI.status ? '[32m' : '[33m'}${fetchAPI.status}![0m${true === retryingMessage ? ' [r]' : ''}${true === body.stream ? ' (s)' : ''} ${clewdStream.broken} broken\n`);
            clewdStream.empty();
        } catch (err) {
            if ('AbortError' === err.name) {
                return res.end();
            }
            console.error('clewd API error:\n%o', err);
            res.json({
                error: {
                    message: err.message || err.name,
                    type: err.type || err.code || err.name,
                    param: null,
                    code: 500
                }
            }, 500);
        } finally {
            clearInterval(titleTimer);
            titleTimer = null;
            if (Settings.DeleteChats && !Settings.RetryRegenerate && !Settings.RecycleChats) {
                try {
                    await deleteChat(uuidTemp);
                } catch (err) {}
                delete UUIDMap[promptSHA];
            }
        }
    }));
}));

Proxy.listen(Port, Ip, (async () => {
    const accRes = await fetch(AI.endPoint() + '/api/organizations', {
        method: 'GET',
        headers: {
            Cookie: Cookie
        }
    });
    const accInfo = (await accRes.json())?.[0];
    if (!accInfo || accInfo.error) {
        throw Error('Couldn\'t get account info ' + (accInfo?.error ? accInfo.error.message : 'have you set your cookie?'));
    }
    if (!accInfo?.uuid) {
        throw Error('Invalid account id');
    }
    setTitle('ok');
    updateCookies(Cookie);
    updateCookies(accRes);
    console.log(`[2mclewd v2.5[0m\n[33mhttp://${Ip}:${Port}/v1[0m\n\n${Object.keys(Settings).map((setting => `[1m${setting}:[0m [36m${Settings[setting]}[0m`)).sort().join('\n')}\n`);
    console.log('Logged in %o', {
        name: accInfo.name?.split('@')?.[0],
        capabilities: accInfo.capabilities
    });
    uuidOrg = accInfo?.uuid;
    if (accInfo?.active_flags.length > 0) {
        const flagNames = accInfo.active_flags.map((flag => flag.type));
        console.warn('[31mYour account has warnings[0m %o', flagNames);
        Settings.ClearFlags && await Promise.all(flagNames.map((flag => (async flag => {
            if ('consumer_restricted_mode' === flag) {
                return;
            }
            const req = await fetch(`${AI.endPoint()}/api/organizations/${uuidOrg}/flags/${flag}/dismiss`, {
                headers: {
                    Cookie: getCookies(),
                    'Content-Type': 'application/json'
                },
                method: 'POST'
            });
            updateCookies(req);
            const json = await req.json();
            console.log(`${flag}: ${json.error ? json.error.message || json.error.type || json.detail : 'OK'}`);
        })(flag))));
    }
    if (Settings.RecycleChats || Settings.DeleteChats) {
        const convRes = await fetch(`${AI.endPoint()}/api/organizations/${uuidOrg}/chat_conversations`, {
            method: 'GET',
            headers: {
                Cookie: getCookies()
            }
        });
        const conversations = await convRes.json();
        conversations.filter((chat => chat.name.length > 0)).forEach((chat => UUIDMap[chat.name] = chat.uuid));
        updateCookies(convRes);
        if (Settings.DeleteChats && conversations.length > 0) {
            console.log(`wiping ${conversations.length} old chats`);
            await Promise.all(conversations.map((conv => deleteChat(conv.uuid))));
        }
    }
}));

Proxy.on('error', (err => {
    console.error('Proxy error\n%o', err);
}));