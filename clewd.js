/**
 * SET YOUR COOKIE HERE
 * @preserve
 */
const Cookie = '';

/**
## EXPERIMENTAL

### SettingName: (DEFAULT)/opt1/opt2

 1. AdaptClaude: (true)/false
    * tries to make human/assistant prompts uniform between endpoints
    * effective both with streaming on and off now
    - Human->H
    - Human<-H
    - Assistant->A
    - Assistant<-A

 2. AntiStall: (false)/1/2
    * no effect when using streaming
    * 1 sends whatever was last when exceeding size (might have some spicy things but impersonations as well)
    * 2 sends a usable message where the bot actually stopped talking

 3. ClearFlags: (false)/true
    * possibly snake-oil

 4. PassParams: (false)/true
    * true will send the temperature you set on your frontent
    * only values under <=1
    * this could get your account banned
    * if clewd stops working, set to false

 5. PreventImperson: (true)/false
    * trims the bot reply immediately if he says "Human:" or "H:"
    * making it so it doesn't hallucinate speaking as you (chance of missing some spicy things)
    * it's probable this will trigger before AntiStall if you have that on

 6. PromptExperiment: (true)/false
    * an alternative way to send your prompt to the AI
    * experiment before setting to false

 7. RecycleChats: (false)/true
    * reuses the same chat on the website, based on the first prompt
    * false is less likely to get caught in a censorship loop

 8. RetryRegenerate: (false)/true
    * uses the AI's own retry mechanism when you regenerate on your frontend
    * instead of a new conversation
    * experiment with it

 9. StripAssistant: (false)/true
    * might be good IF your prompt/jailbreak itself ends with Assistant: 

 10. StripHuman: (false)/true
    * bad idea without RecycleChats, sends only your very last message

 * @preserve
 */ const Settings = {
    AdaptClaude: true,
    AntiStall: false,
    ClearFlags: false,
    PassParams: false,
    PreventImperson: true,
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
 */ const StallTriggerMax = 4194304;

const StallTrigger = 1572864;

const {createServer: Server, IncomingMessage: IncomingMessage, ServerResponse: ServerResponse} = require('node:http');
const {createHash: Hash, randomUUID: UUID, randomInt: randomInt, randomBytes: randomBytes} = require('node:crypto');
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

const findHuman = (text, last = false) => {
    const humanArray = [ last ? text.lastIndexOf(Human) : text.indexOf(Human), last ? text.lastIndexOf(H) : text.indexOf(H) ].filter((location => location > -1)).sort();
    const location = humanArray?.[last ? humanArray.length - 1 : 0] || -1;
    return location >= 0 ? location : null;
};

const findAssistant = (text, last = false) => {
    const assistantArray = [ last ? text.lastIndexOf(Assistant) : text.indexOf(Assistant), last ? text.lastIndexOf(A) : text.indexOf(A) ].filter((location => location > -1)).sort();
    const location = assistantArray?.[last ? assistantArray.length - 1 : 0] || -1;
    return location >= 0 ? location : null;
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

const setTitle = title => {
    title = 'clewd v2.3 - ' + title;
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
            const fakeHuman = findHuman(validCompletion);
            console.log('[31mstall: 2[0m');
            controller.enqueue(this.#build(fakeHuman));
            return controller.terminate();
        }
    }
    #impersonationCheck(controller, completion) {
        if (!Settings.PreventImperson) {
            return;
        }
        let cutLimit = completion.length;
        const fakeHumanPrompt = findHuman(completion);
        if (null !== fakeHumanPrompt) {
            cutLimit = fakeHumanPrompt;
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
            const firstAssistantIdx = findAssistant(prompt);
            const lastAssistantIdx = findAssistant(prompt, true);
            const lastHumanIdx = findHuman(prompt, true);
            /**
             * Ideally SillyTavern would expose a unique frontend conversation_uuid prop to localhost proxies
             * could set the name to a hash of it
             * then fetch /chat_conversations with 'GET' and find it
             * @preserve
             */            const hash = Hash('sha1');
            hash.update(prompt.substring(0, firstAssistantIdx));
            const sha = Settings.RecycleChats ? hash.digest('hex') : '';
            const uuidOld = UUIDMap[sha];
            Settings.StripHuman && lastHumanIdx && uuidOld && (prompt = prompt.substring(lastHumanIdx, prompt.length));
            Settings.StripAssistant && lastAssistantIdx && (prompt = prompt.substring(0, lastAssistantIdx));
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
                uuidTemp = UUID().toString();
                fetchAPI = await fetch(`${AI.endPoint()}/api/organizations/${uuidOrg}/chat_conversations`, {
                    signal: signal,
                    headers: {
                        Cookie: getCookies(),
                        'Content-Type': 'application/json'
                    },
                    method: 'POST',
                    body: JSON.stringify({
                        uuid: uuidTemp,
                        name: sha
                    })
                });
                updateCookies(fetchAPI);
                console.log('' + model);
                UUIDMap[sha] = uuidTemp;
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
            const clewdStream = new ClewdStream(25, model, true === body.stream);
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
            console.log(`${200 == fetchAPI.status ? '[32m' : '[33m'}${fetchAPI.status}![0m${true === retryingMessage ? ' [r]' : ''}${true === body.stream ? ' (s)' : ''} ${(clewdStream.invalid / clewdStream.total * 100).toFixed(2)}% broken\n`);
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
        }
    }));
}));

Proxy.listen(Port, Ip, (async () => {
    const accReq = await fetch(AI.endPoint() + '/api/organizations', {
        method: 'GET',
        headers: {
            Cookie: Cookie
        }
    });
    const accInfo = (await accReq.json())?.[0];
    if (!accInfo || accInfo.error) {
        throw Error('Couldn\'t get account info ' + (accInfo?.error ? accInfo.error.message : 'have you set your cookie?'));
    }
    if (!accInfo?.uuid) {
        throw Error('Invalid account id');
    }
    setTitle('ok');
    updateCookies(Cookie);
    updateCookies(accReq);
    console.log(`[2mclewd v2.2[0m\n[33mhttp://${Ip}:${Port}/v1[0m\n\n${Object.keys(Settings).map((setting => `[1m${setting}:[0m [36m${Settings[setting]}[0m`)).sort().join('\n')}\n`);
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
    if (Settings.RecycleChats) {
        const convReq = await fetch(`${AI.endPoint()}/api/organizations/${uuidOrg}/chat_conversations`, {
            method: 'GET',
            headers: {
                Cookie: getCookies()
            }
        });
        (await convReq.json()).filter((chat => chat.name.length > 0)).forEach((chat => UUIDMap[chat.name] = chat.uuid));
        updateCookies(convReq);
    }
}));

Proxy.on('error', (err => {
    console.error('Proxy error\n%o', err);
}));