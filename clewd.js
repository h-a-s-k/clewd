/*
* https://gitgud.io/ahsk/clewd
* https://github.com/h-a-s-k/clewd
*/
'use strict';

const {createServer: Server, IncomingMessage, ServerResponse} = require('node:http'), {createHash: Hash, randomUUID, randomInt, randomBytes} = require('node:crypto'), {TransformStream, ReadableStream} = require('node:stream/web'), {Readable, Writable} = require('node:stream'), {Blob} = require('node:buffer'), FS = require('node:fs'), Path = require('node:path'), Decoder = new TextDecoder, Encoder = new TextEncoder;

let ChangedSettings, UnknownSettings, Logger, Superfetch = null;

const ConfigPath = Path.join(__dirname, './config.js'), LogPath = Path.join(__dirname, './log.txt'), Replacements = {
    user: 'Human',
    assistant: 'Assistant',
    system: '',
    example_user: 'H',
    example_assistant: 'A'
}, DangerChars = [ ...new Set([ ...Object.values(Replacements).join(''), ...'\n', ':', ...'\\n' ]) ].filter((char => ' ' !== char)).sort(), Conversation = {
    char: null,
    uuid: null,
    depth: 0
}, cookies = {};

let uuidOrg, curPrompt = {}, prevPrompt = {}, prevMessages = [], prevImpersonated = false, Config = {
    Cookie: '',
    Ip: '127.0.0.1',
    Port: 8444,
    BufferSize: 8,
    SystemInterval: 3,
    PersonalityFormat: '{{char}}\'s personality: {{personality}}',
    ScenarioFormat: 'Dialogue scenario: {{scenario}}',
    Settings: {
        RenewAlways: true,
        RetryRegenerate: false,
        PromptExperiments: true,
        SystemExperiments: true,
        PreventImperson: false,
        AllSamples: false,
        NoSamples: false,
        StripAssistant: false,
        StripHuman: false,
        PassParams: false,
        ClearFlags: false,
        PreserveChats: false,
        LogMessages: false,
        Superfetch: true
    },
    SuperfetchHost: 'localhost',
    SuperfetchPort: 8443,
    SuperfetchTimeout: 120
};

const {version: Version} = require('./package.json'), Main = 'clewd v' + Version;

ServerResponse.prototype.json = async function(body, statusCode = 200, headers) {
    body = body instanceof Promise ? await body : body;
    this.headersSent || this.writeHead(statusCode, {
        'Content-Type': 'application/json',
        ...headers && headers
    });
    this.end('object' == typeof body ? JSON.stringify(body) : body);
    return this;
};

Array.prototype.sample = function() {
    return this[Math.floor(Math.random() * this.length)];
};

const AI = {
    end: () => Buffer.from([ 104, 116, 116, 112, 115, 58, 47, 47, 99, 108, 97, 117, 100, 101, 46, 97, 105 ]).toString(),
    mdl: () => JSON.parse(Buffer.from([ 91, 34, 99, 108, 97, 117, 100, 101, 45, 51, 45, 111, 112, 117, 115, 45, 50, 48, 50, 52, 48, 50, 50, 57, 34, 44, 34, 99, 108, 97, 117, 100, 101, 45, 51, 45, 53, 45, 115, 111, 110, 110, 101, 116, 45, 50, 48, 50, 52, 48, 54, 50, 48, 34, 44, 34, 99, 108, 97, 117, 100, 101, 45, 51, 45, 115, 111, 110, 110, 101, 116, 45, 50, 48, 50, 52, 48, 50, 50, 57, 34, 44, 34, 99, 108, 97, 117, 100, 101, 45, 51, 45, 104, 97, 105, 107, 117, 45, 50, 48, 50, 52, 48, 51, 48, 55, 34, 44, 34, 99, 108, 97, 117, 100, 101, 45, 50, 46, 49, 34, 44, 34, 99, 108, 97, 117, 100, 101, 45, 50, 46, 48, 34, 44, 34, 99, 108, 97, 117, 100, 101, 45, 105, 110, 115, 116, 97, 110, 116, 45, 49, 46, 50, 34, 93 ]).toString()),
    zone: () => Buffer.from([ 65, 109, 101, 114, 105, 99, 97, 47, 78, 101, 119, 95, 89, 111, 114, 107 ]).toString(),
    agent: () => Buffer.from([ 77, 111, 122, 105, 108, 108, 97, 47, 53, 46, 48, 32, 40, 77, 97, 99, 105, 110, 116, 111, 115, 104, 59, 32, 73, 110, 116, 101, 108, 32, 77, 97, 99, 32, 79, 83, 32, 88, 32, 49, 48, 95, 49, 53, 95, 55, 41, 32, 65, 112, 112, 108, 101, 87, 101, 98, 75, 105, 116, 47, 53, 51, 55, 46, 51, 54, 32, 40, 75, 72, 84, 77, 76, 44, 32, 108, 105, 107, 101, 32, 71, 101, 99, 107, 111, 41, 32, 67, 104, 114, 111, 109, 101, 47, 49, 49, 52, 46, 48, 46, 48, 46, 48, 32, 83, 97, 102, 97, 114, 105, 47, 53, 51, 55, 46, 51, 54, 32, 69, 100, 103, 47, 49, 49, 52, 46, 48, 46, 49, 56, 50, 51, 46, 55, 57 ]).toString(),
    cp: () => Buffer.from([ 55, 55, 49, 44, 52, 56, 54, 53, 45, 52, 56, 54, 54, 45, 52, 56, 54, 55, 45, 52, 57, 49, 57, 53, 45, 52, 57, 49, 57, 57, 45, 52, 57, 49, 57, 54, 45, 52, 57, 50, 48, 48, 45, 53, 50, 51, 57, 51, 45, 53, 50, 51, 57, 50, 45, 52, 57, 49, 55, 49, 45, 52, 57, 49, 55, 50, 45, 49, 53, 54, 45, 49, 53, 55, 45, 52, 55, 45, 53, 51, 44, 48, 45, 50, 51, 45, 54, 53, 50, 56, 49, 45, 49, 48, 45, 49, 49, 45, 51, 53, 45, 49, 54, 45, 53, 45, 49, 51, 45, 49, 56, 45, 53, 49, 45, 52, 53, 45, 52, 51, 45, 50, 55, 45, 49, 55, 53, 49, 51, 45, 50, 49, 44, 50, 57, 45, 50, 51, 45, 50, 52, 44, 48 ]).toString(),
    hdr: () => ({
        'Content-Type': 'application/json',
        Referer: AI.end() + '/',
        Origin: '' + AI.end()
    })
}, fileName = () => {
    const len = randomInt(5, 15);
    let name = randomBytes(len).toString('hex');
    for (let i = 0; i < name.length; i++) {
        const char = name.charAt(i);
        isNaN(char) && randomInt(1, 5) % 2 == 0 && ' ' !== name.charAt(i - 1) && (name = name.slice(0, i) + ' ' + name.slice(i));
    }
    return name + '.txt';
}, bytesToSize = (bytes = 0) => {
    const b = [ 'B', 'KB', 'MB', 'GB', 'TB' ];
    if (0 === bytes) {
        return '0 B';
    }
    const c = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), 4);
    return 0 === c ? `${bytes} ${b[c]}` : `${(bytes / 1024 ** c).toFixed(1)} ${b[c]}`;
}, genericFixes = text => text.replace(/(\r\n|\r|\\n)/gm, '\n'), updateParams = res => {
    updateCookies(res);
}, updateCookies = res => {
    let cookieNew = '';
    res instanceof Response ? cookieNew = res.headers?.get('set-cookie') : res?.superfetch ? cookieNew = res.headers?.['Set-Cookie'] : 'string' == typeof res && (cookieNew = res.split('\n').join(''));
    if (!cookieNew) {
        return;
    }
    let cookieArr = cookieNew.split(/;\s?/gi).filter((prop => false === /^(path|expires|domain|HttpOnly|Secure|SameSite)[=;]*/i.test(prop)));
    for (const cookie of cookieArr) {
        const divide = cookie.split(/^(.*?)=\s*(.*)/);
        if (1 === divide.length) {
            continue;
        }
        const cookieName = divide[1], cookieVal = divide[2];
        cookies[cookieName] = cookieVal;
    }
}, getCookies = () => {
    const cookieNames = Object.keys(cookies);
    return cookieNames.map(((name, idx) => `${name}=${cookies[name]}${idx === cookieNames.length - 1 ? '' : ';'}`)).join(' ').replace(/(\s+)$/gi, '');
}, superfetch = async (url, params) => {
    let res = {};
    const options = {
        ...(url || params.url) && {
            url: url || params.url
        },
        method: params.method,
        headers: {
            ...AI.hdr(),
            ...params.headers && {
                ...params.headers
            }
        },
        ...params.body && {
            body: 'string' != typeof params.body ? JSON.stringify(params.body) : params.body
        },
        userAgent: AI.agent(),
        ja3: AI.cp(),
        timeout: Config.SuperfetchTimeout,
        disableRedirect: true
    };
    try {
        const {response} = await Superfetch.request(options);
        res = response;
        res.json = function() {
            return JSON.parse(this.body || '{}');
        };
    } catch (err) {
        console.error('Report this to the dev:\n%o', err);
    }
    res.superfetch = true;
    return res;
}, deleteChat = async uuid => {
    if (!uuid) {
        return;
    }
    if (uuid === Conversation.uuid) {
        Conversation.uuid = null;
        Conversation.depth = 0;
    }
    if (Config.Settings.PreserveChats) {
        return;
    }
    const res = await (Config.Settings.Superfetch ? superfetch : fetch)(`${AI.end()}/api/organizations/${uuidOrg}/chat_conversations/${uuid}`, {
        headers: {
            ...AI.hdr(),
            Cookie: getCookies()
        },
        method: 'DELETE'
    });
    updateParams(res);
}, setTitle = title => {
    title = `${Main} - ${title}`;
    process.title !== title && (process.title = title);
}, onListen = async () => {
    if ('SET YOUR COOKIE HERE' === Config.Cookie || Config.Cookie?.length < 1) {
        throw Error('Set your cookie inside config.js');
    }
    updateCookies(Config.Cookie);
    console.log(`[2m${Main}[0m\n[33mhttp://${Config.Ip}:${Config.Port}/v1[0m\n\n${Object.keys(Config.Settings).map((setting => UnknownSettings.includes(setting) ? `??? [31m${setting}: ${Config.Settings[setting]}[0m` : `[1m${setting}:[0m ${ChangedSettings.includes(setting) ? '[33m' : '[36m'}${Config.Settings[setting]}[0m`)).sort().join('\n')}\n`);
    Superfetch = Config.Settings.Superfetch ? new (require('./lib/clewd-superfetch.js'))({
        host: Config.SuperfetchHost,
        port: Config.SuperfetchPort
    }) : null;
    await (Superfetch?.init());
    const accRes = await (Config.Settings.Superfetch ? superfetch : fetch)(AI.end() + '/api/organizations', {
        method: 'GET',
        headers: {
            ...AI.hdr(),
            Cookie: getCookies()
        }
    }), accInfo = (await accRes.json())?.[0];
    if (!accInfo || accInfo.error) {
        const alternativeJson = accRes.json();
        throw Error(`Couldn't get account info: "${accInfo?.error?.message || accRes.statusText || alternativeJson.error?.message}"`);
    }
    if (!accInfo?.uuid) {
        throw Error('Invalid account id');
    }
    setTitle('ok');
    updateParams(accRes);
    await checkResErr(accRes);
    console.log('Logged in %o', {
        name: accInfo.name?.split('@')?.[0],
        capabilities: accInfo.capabilities
    });
    uuidOrg = accInfo?.uuid;
    if (accInfo?.active_flags.length > 0) {
        const now = new Date, formattedFlags = accInfo.active_flags.map((flag => {
            const days = ((new Date(flag.expires_at).getTime() - now.getTime()) / 864e5).toFixed(2);
            return {
                type: flag.type,
                remaining_days: days
            };
        }));
        console.warn('[31mYour account has warnings[0m %o', formattedFlags);
        await Promise.all(accInfo.active_flags.map((flag => (async type => {
            if (!Config.Settings.ClearFlags) {
                return;
            }
            if ('consumer_restricted_mode' === type) {
                return;
            }
            const req = await (Config.Settings.Superfetch ? superfetch : fetch)(`${AI.end()}/api/organizations/${uuidOrg}/flags/${type}/dismiss`, {
                headers: {
                    ...AI.hdr(),
                    Cookie: getCookies()
                },
                method: 'POST'
            });
            updateParams(req);
            const json = await req.json();
            console.log(`${type}: ${json.error ? json.error.message || json.error.type || json.detail : 'OK'}`);
        })(flag.type))));
    }
    const convRes = await (Config.Settings.Superfetch ? superfetch : fetch)(`${AI.end()}/api/organizations/${uuidOrg}/chat_conversations`, {
        method: 'GET',
        headers: {
            ...AI.hdr(),
            Cookie: getCookies()
        }
    }), conversations = await convRes.json();
    updateParams(convRes);
    conversations.length > 0 && await Promise.all(conversations.map((conv => deleteChat(conv.uuid))));
}, checkResErr = async res => {
    if (res.status < 200 || res.status >= 300) {
        let err = Error('Unexpected response code: ' + res.status);
        try {
            let json, error;
            if (res.superfetch) {
                error = {
                    message: res.body,
                    ...res
                };
                delete error.body;
            } else {
                json = await res.json();
                error = json.error;
            }
            if (error) {
                err.planned = true;
                error.message && (err.message = error.message);
                error.type && (err.type = error.type);
                if (429 === res.status && error.resets_at) {
                    const hours = ((new Date(1e3 * error.resets_at).getTime() - Date.now()) / 1e3 / 60 / 60).toFixed(2);
                    err.message += `, expires in ${hours} hours`;
                }
            }
        } catch (err) {}
        throw Error(err);
    }
};

class ClewdStream extends TransformStream {
    constructor(minSize = 8, modelName = AI.mdl(), streaming, abortController) {
        super({
            transform: (chunk, controller) => {
                this.#handle(chunk, controller);
            },
            flush: controller => {
                this.#done(controller);
            }
        });
        this.#modelName = modelName;
        this.#streaming = streaming;
        this.#minSize = minSize;
        this.#abortController = abortController;
    }
    #streaming=void 0;
    #minSize=void 0;
    #compOK='';
    #compRaw='';
    #abortController=void 0;
    #modelName=void 0;
    #compAll=[];
    #recvLength=0;
    #stopLoc=void 0;
    #stopReason=void 0;
    #hardCensor=false;
    #impersonated=false;
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
        Logger?.write(selection);
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
        return this.#streaming ? (completion => Encoder.encode(`data: ${JSON.stringify(completion)}\n\n`))(completion) : JSON.stringify(completion);
    }
    #print() {}
    #done(controller) {
        this.#print();
        328 === this.#recvLength && (this.#hardCensor = true);
        if (this.#streaming) {
            this.#compOK.length > 0 && controller.enqueue(this.#build(this.#compOK));
            controller.enqueue('data: [DONE]\n\n');
        } else {
            controller.enqueue(this.#build(this.#compAll.join('')));
        }
    }
    #impersonationCheck(reply, controller) {
        const fakeAny = ((text, last = false) => {
            let location = -1;
            const fakeHuman = ((text, last = false) => {
                let location = -1;
                const matchesH = text.match(/(?:(?:\\n)|\n){2}((?:Human|H): ?)/gm);
                matchesH?.length > 0 && (location = last ? text.lastIndexOf(matchesH[matchesH.length - 1]) : text.indexOf(matchesH[0]));
                return location;
            })(text, last), fakeAssistant = ((text, last = false) => {
                let location = -1;
                const matchesA = text.match(/(?:(?:\\n)|\n){2}((?:Assistant|A): ?)/gm);
                matchesA?.length > 0 && (location = last ? text.lastIndexOf(matchesA[matchesA.length - 1]) : text.indexOf(matchesA[0]));
                return location;
            })(text, last), fakes = [ fakeHuman, fakeAssistant ].filter((idx => idx > -1)).sort();
            location = last ? fakes.reverse()[0] : fakes[0];
            return isNaN(location) ? -1 : location;
        })(reply);
        if (fakeAny > -1) {
            this.#impersonated = true;
            if (Config.Settings.PreventImperson) {
                const selection = reply.substring(0, fakeAny);
                console.warn(`[33mimpersonation, dropped:[0m "[4m${reply.substring(fakeAny, reply.length).replace(/\n/g, '\\n')}[0m..."`);
                controller.enqueue(this.#build(selection));
                this.#streaming && controller.enqueue('data: [DONE]\n\n');
                this.#print();
                this.#abortController.abort();
                return controller.terminate();
            }
        }
    }
    #parseMatch(match, controller) {
        let parsed, delayChunk;
        try {
            match = match.replace(/^event: (?:completion|ping)[\n]*data: {/i, '{').trim();
            parsed = JSON.parse(match);
            if ('ping' === parsed.type) {
                this.#compRaw = '';
                return;
            }
            if (parsed.error) {
                parsed.completion = `## ${Main}\n**${AI.end()} error**:\n\n\`\`\`${JSON.stringify(parsed.error, null, 4)}\`\`\``;
                console.warn('[31mwebsite err[0m');
            }
            if (parsed.completion) {
                parsed.completion = genericFixes(parsed.completion);
                this.#compOK += parsed.completion;
                this.#compRaw = '';
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
    #handle(chunk, controller) {
        'string' == typeof chunk && (chunk = Encoder.encode(chunk));
        this.#recvLength += chunk.byteLength || 0;
        this.#compRaw += Decoder.decode(chunk);
        const matches = this.#compRaw.split(/(\n){1}/gm).filter((match => match.length > 0 && '\n' !== match));
        for (const match of matches) {
            [ 'event: completion', 'event: ping' ].includes(match) || this.#parseMatch(match, controller);
        }
    }
}

const writeSettings = async (config, firstRun = false) => {
    FS.writeFileSync(ConfigPath, `/*\n* https://gitgud.io/ahsk/clewd\n* https://github.com/h-a-s-k/clewd\n*/\n\n// SET YOUR COOKIE BELOW\n\nmodule.exports = ${JSON.stringify(config, null, 4)}\n\n/*\n BufferSize\n * How many characters will be buffered before the AI types once\n * lower = less chance of \`PreventImperson\` working properly\n\n ---\n\n SystemInterval\n * How many messages until \`SystemExperiments alternates\`\n\n ---\n\n Other settings\n * https://gitgud.io/ahsk/clewd/#defaults\n * and\n * https://gitgud.io/ahsk/clewd/-/blob/master/CHANGELOG.md\n */`.trim().replace(/((?<!\r)\n|\r(?!\n))/g, '\r\n'));
    if (firstRun) {
        console.warn('[33mconfig file created!\nedit[0m [1mconfig.js[0m [33mto set your settings and restart the program[0m');
        process.exit(0);
    }
}, Proxy = Server((async (req, res) => {
    if ('OPTIONS' === req.method) {
        return ((req, res) => {
            res.writeHead(200, {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Authorization, Content-Type',
                'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
            }).end();
        })(0, res);
    }
    switch (req.url) {
      case '/v1/models':
        const modelsReply = {
            object: 'list',
            data: AI.mdl().map((name => ({
                id: name,
                object: 'model',
                created: 0,
                owned_by: 'clewd'
            })))
        };
        res.json(modelsReply);
        break;

      case '/v1/chat/completions':
        ((req, res) => {
            setTitle('recv...');
            let fetchAPI;
            const controller = new AbortController, {signal} = controller;
            res.socket.on('close', (async () => {
                controller.signal.aborted || controller.abort();
            }));
            const buffer = [];
            req.on('data', (chunk => {
                buffer.push(chunk);
            }));
            req.on('end', (async () => {
                let clewdStream, titleTimer, samePrompt = false, shouldRenew = true, retryRegen = false;
                try {
                    const body = JSON.parse(Buffer.concat(buffer).toString()), temperature = Math.max(.1, Math.min(1, body.temperature));
                    let {messages} = body;
                    if (messages?.length < 1) {
                        throw Error('Select OpenAI as completion source');
                    }
                    if (!body.stream && 1 === messages.length && JSON.stringify(messages.sort() || []) === JSON.stringify([ {
                        role: 'user',
                        content: 'Hi'
                    } ].sort())) {
                        return res.json({
                            choices: [ {
                                message: {
                                    content: Main
                                }
                            } ]
                        });
                    }
                    res.setHeader('Access-Control-Allow-Origin', '*');
                    body.stream && res.setHeader('Content-Type', 'text/event-stream');
                    if (!body.stream && messages?.[0]?.content?.startsWith('From the list below, choose a word that best represents a character\'s outfit description, action, or emotion in their dialogue')) {
                        return res.json({
                            choices: [ {
                                message: {
                                    content: 'neutral'
                                }
                            } ]
                        });
                    }
                    if (Config.Settings.AllSamples && Config.Settings.NoSamples) {
                        console.log('[33mhaving[0m [1mAllSamples[0m and [1mNoSamples[0m both set to true is not supported');
                        throw Error('Only one can be used at the same time: AllSamples/NoSamples');
                    }
                    const model = body.model;
                    if (!/^claude-.*/i.test(model)) {
                        throw Error(`Invalid model selected: ${model}, use one of these ${AI.mdl().join(', ')}`);
                    }
                    curPrompt = {
                        firstUser: messages.find((message => 'user' === message.role)),
                        firstSystem: messages.find((message => 'system' === message.role)),
                        firstAssistant: messages.find((message => 'assistant' === message.role)),
                        lastUser: messages.findLast((message => 'user' === message.role)),
                        lastSystem: messages.findLast((message => 'system' === message.role && '[Start a new chat]' !== message.content)),
                        lastAssistant: messages.findLast((message => 'assistant' === message.role))
                    };
                    prevPrompt = {
                        ...prevMessages.length > 0 && {
                            firstUser: prevMessages.find((message => 'user' === message.role)),
                            firstSystem: prevMessages.find((message => 'system' === message.role)),
                            firstAssistant: prevMessages.find((message => 'assistant' === message.role)),
                            lastUser: prevMessages.findLast((message => 'user' === message.role)),
                            lastSystem: prevMessages.find((message => 'system' === message.role && '[Start a new chat]' !== message.content)),
                            lastAssistant: prevMessages.findLast((message => 'assistant' === message.role))
                        }
                    };
                    samePrompt = JSON.stringify(messages.filter((message => 'system' !== message.role)).sort()) === JSON.stringify(prevMessages.filter((message => 'system' !== message.role)).sort());
                    const sameCharDiffChat = !samePrompt && curPrompt.firstSystem?.content === prevPrompt.firstSystem?.content && curPrompt.firstUser.content !== prevPrompt.firstUser?.content;
                    shouldRenew = Config.Settings.RenewAlways || !Conversation.uuid || prevImpersonated || !Config.Settings.RenewAlways && samePrompt || sameCharDiffChat;
                    retryRegen = Config.Settings.RetryRegenerate && samePrompt && null != Conversation.uuid;
                    samePrompt || (prevMessages = JSON.parse(JSON.stringify(messages)));
                    let type = '';
                    if (retryRegen) {
                        type = 'R';
                        fetchAPI = await (async (signal, body, model) => {
                            let res;
                            const json = {
                                completion: {
                                    prompt: '',
                                    timezone: AI.zone(),
                                    model
                                },
                                organization_uuid: uuidOrg,
                                conversation_uuid: Conversation.uuid,
                                text: ''
                            };
                            res = Config.Settings.Superfetch ? await superfetch(AI.end() + '/api/retry_message', {
                                method: 'POST',
                                body: json,
                                headers: {
                                    Accept: 'text/event-stream',
                                    Cookie: getCookies(),
                                    'User-Agent': AI.agent()
                                }
                            }) : await fetch(AI.end() + '/api/retry_message', {
                                signal,
                                headers: {
                                    ...AI.hdr(),
                                    Cookie: getCookies()
                                },
                                method: 'POST',
                                body: JSON.stringify(json)
                            });
                            updateParams(res);
                            await checkResErr(res);
                            return res;
                        })(signal, 0, model);
                    } else if (shouldRenew) {
                        Conversation.uuid && await deleteChat(Conversation.uuid);
                        fetchAPI = await (async signal => {
                            Conversation.uuid = randomUUID().toString();
                            Conversation.depth = 0;
                            const res = await (Config.Settings.Superfetch ? superfetch : fetch)(`${AI.end()}/api/organizations/${uuidOrg}/chat_conversations`, {
                                signal,
                                headers: {
                                    ...AI.hdr(),
                                    Cookie: getCookies()
                                },
                                method: 'POST',
                                body: JSON.stringify({
                                    uuid: Conversation.uuid,
                                    name: ''
                                })
                            });
                            updateParams(res);
                            await checkResErr(res);
                            return res;
                        })(signal);
                        type = 'r';
                    } else if (samePrompt) {} else {
                        const systemExperiment = !Config.Settings.RenewAlways && Config.Settings.SystemExperiments;
                        if (!systemExperiment || systemExperiment && Conversation.depth >= Config.SystemInterval) {
                            type = 'c-r';
                            Conversation.depth = 0;
                        } else {
                            type = 'c-c';
                            Conversation.depth++;
                        }
                    }
                    let {prompt, systems} = ((messages, type) => {
                        const rgxScenario = /^\[Circumstances and context of the dialogue: ([\s\S]+?)\.?\]$/i, rgxPerson = /^\[([\s\S]+?)'s personality: ([\s\S]+?)\]$/i, messagesClone = JSON.parse(JSON.stringify(messages)), realLogs = messagesClone.filter((message => [ 'user', 'assistant' ].includes(message.role))), sampleLogs = messagesClone.filter((message => message.name)), mergedLogs = [ ...sampleLogs, ...realLogs ];
                        mergedLogs.forEach(((message, idx) => {
                            const nextMessage = mergedLogs[idx + 1];
                            message.customname = (message => [ 'assistant', 'user' ].includes(message.role) && message.name && !(message.name in Replacements))(message);
                            if (nextMessage) {
                                const spacing = message.content.endsWith('\n') ? '' : '\n';
                                if ('name' in message && 'name' in nextMessage) {
                                    if (message.name === nextMessage.name) {
                                        message.content += `${spacing}${nextMessage.content}`;
                                        nextMessage.discard = true;
                                    }
                                } else if ([ 'user', 'assistant' ].includes(nextMessage.role)) {
                                    if (nextMessage.role === message.role) {
                                        message.content += `${spacing}${nextMessage.content}`;
                                        nextMessage.discard = true;
                                    }
                                } else {
                                    message.content += `${spacing}${nextMessage.content}`;
                                    nextMessage.discard = true;
                                }
                            }
                        }));
                        const lastAssistant = realLogs.findLast((message => !message.discard && 'assistant' === message.role));
                        lastAssistant && Config.Settings.StripAssistant && (lastAssistant.strip = true);
                        const lastUser = realLogs.findLast((message => !message.discard && 'user' === message.role));
                        lastUser && Config.Settings.StripHuman && (lastUser.strip = true);
                        const systemMessages = messagesClone.filter((message => 'system' === message.role && !message.name));
                        systemMessages.forEach(((message, idx) => {
                            const scenario = message.content.match(rgxScenario)?.[1], personality = message.content.match(rgxPerson);
                            if (scenario) {
                                message.content = Config.ScenarioFormat.replace(/{{scenario}}/gim, scenario);
                                message.scenario = true;
                            }
                            if (3 === personality?.length) {
                                message.content = Config.PersonalityFormat.replace(/{{char}}/gim, personality[1]).replace(/{{personality}}/gim, personality[2]);
                                message.personality = true;
                            }
                            message.main = 0 === idx;
                            message.jailbreak = idx === systemMessages.length - 1;
                            ' ' === message.content && (message.discard = true);
                        }));
                        Config.Settings.AllSamples && !Config.Settings.NoSamples && realLogs.forEach((message => {
                            if ('user' === message.role) {
                                message.name = message.customname ? message.name : 'example_user';
                                message.role = 'system';
                            } else if ('assistant' === message.role) {
                                message.name = message.customname ? message.name : 'example_assistant';
                                message.role = 'system';
                            } else if (!message.customname) {
                                throw Error('Invalid role ' + message.name);
                            }
                        }));
                        Config.Settings.NoSamples && !Config.Settings.AllSamples && sampleLogs.forEach((message => {
                            if ('example_user' === message.name) {
                                message.role = 'user';
                            } else if ('example_assistant' === message.name) {
                                message.role = 'assistant';
                            } else if (!message.customname) {
                                throw Error('Invalid role ' + message.name);
                            }
                            message.customname || delete message.name;
                        }));
                        let systems = [];
                        if (![ 'r', 'R' ].includes(type)) {
                            lastUser.strip = true;
                            systemMessages.forEach((message => message.discard = message.discard || 'c-c' === type ? !message.jailbreak : !message.jailbreak && !message.main));
                            systems = systemMessages.filter((message => !message.discard)).map((message => `"${message.content.substring(0, 25).replace(/\n/g, '\\n').trim()}..."`));
                            messagesClone.forEach((message => message.discard = message.discard || mergedLogs.includes(message) && ![ lastUser ].includes(message)));
                        }
                        const prompt = messagesClone.map(((message, idx) => {
                            if (message.discard) {
                                return '';
                            }
                            if (message.content.length < 1) {
                                return message.content;
                            }
                            let spacing = '';
                            idx > 0 && (spacing = systemMessages.includes(message) ? '\n' : '\n\n');
                            const prefix = message.customname ? message.name + ': ' : 'system' !== message.role || message.name ? Replacements[message.name || message.role] + ': ' : '' + Replacements[message.role];
                            return `${spacing}${message.strip ? '' : prefix}${message.content.trim()}`;
                        }));
                        return {
                            prompt: genericFixes(prompt.join('')).trim(),
                            systems
                        };
                    })(messages, type);
                    console.log(`${model} [[2m${type}[0m]${!retryRegen && systems.length > 0 ? ' ' + systems.join(' [33m/[0m ') : ''}`);
                    'R' !== type || prompt || (prompt = '...regen...');
                    Logger?.write(`\n\n-------\n[${(new Date).toLocaleString()}]\n####### PROMPT (${type}):\n${prompt}\n--\n####### REPLY:\n`);
                    retryRegen || (fetchAPI = await (async (signal, body, model, prompt, temperature) => {
                        const attachments = [];
                        if (Config.Settings.PromptExperiments) {
                            attachments.push({
                                extracted_content: prompt,
                                file_name: fileName(),
                                file_size: Buffer.from(prompt).byteLength,
                                file_type: 'text/plain'
                            });
                            prompt = '';
                        }
                        let res;
                        const json = {
                            attachments,
                            files: [],
                            model,
                            ...Config.Settings.PassParams && {
                                temperature
                            },
                            prompt: prompt || '',
                            timezone: AI.zone()
                        };
                        res = Config.Settings.Superfetch ? await superfetch(`${AI.end()}/api/organizations/${uuidOrg || ''}/chat_conversations/${Conversation.uuid || ''}/completion`, {
                            method: 'POST',
                            body: json,
                            headers: {
                                ...AI.hdr(),
                                Accept: 'text/event-stream',
                                Cookie: getCookies(),
                                'User-Agent': AI.agent()
                            }
                        }) : await fetch(`${AI.end()}/api/organizations/${uuidOrg || ''}/chat_conversations/${Conversation.uuid || ''}/completion`, {
                            signal,
                            method: 'POST',
                            body: JSON.stringify(json),
                            headers: {
                                ...AI.hdr(),
                                Accept: 'text/event-stream',
                                Cookie: getCookies(),
                                'User-Agent': AI.agent()
                            }
                        });
                        updateParams(res);
                        await checkResErr(res);
                        return res;
                    })(signal, 0, model, prompt, temperature));
                    const response = Writable.toWeb(res);
                    clewdStream = new ClewdStream(Config.BufferSize, model, body.stream, controller);
                    if (Config.Settings.Superfetch) {
                        const superStream = new ReadableStream({
                            start(controller) {
                                fetchAPI.body.split('\n').filter((message => '\n' !== message)).forEach((message => controller.enqueue(message)));
                                controller.close();
                            }
                        });
                        await superStream.pipeThrough(clewdStream).pipeTo(response).catch((() => {}));
                        setTitle('ok ' + bytesToSize(clewdStream.size));
                    } else {
                        titleTimer = setInterval((() => setTitle('recv ' + bytesToSize(clewdStream.size))), 300);
                        await fetchAPI.body.pipeThrough(clewdStream).pipeTo(response);
                    }
                } catch (err) {
                    if ('AbortError' === err.name) {
                        return res.end();
                    }
                    err.planned || console.error('[33mClewd:[0m\n%o', err);
                    res.json({
                        error: {
                            message: 'clewd: ' + (err.message || err.name || err.type),
                            type: err.type || err.name || err.code,
                            param: null,
                            code: err.code || 500
                        }
                    });
                } finally {
                    Config.Settings.Superfetch || clearInterval(titleTimer);
                    if (clewdStream) {
                        clewdStream.censored && console.warn('[33mlikely your account is hard-censored[0m');
                        prevImpersonated = clewdStream.impersonated;
                        console.log(`${200 == fetchAPI.status ? '[32m' : '[33m'}${fetchAPI.status}![0m\n`);
                        setTitle('ok ' + bytesToSize(clewdStream.size));
                        clewdStream.empty();
                    }
                    if (prevImpersonated) {
                        try {
                            await deleteChat(Conversation.uuid);
                        } catch (err) {}
                    }
                }
            }));
        })(req, res);
        break;

      case '/v1/complete':
        res.json({
            error: {
                message: 'clewd: Set "Chat Completion source" to OpenAI instead of Claude. Enable "External" models aswell'
            }
        });
        break;

      default:
        console.log('unknown request: ' + req.url);
        res.json({
            error: {
                message: '404 Not Found',
                type: 404,
                param: null,
                code: 404
            }
        }, 404);
    }
}));

!async function() {
    await (async () => {
        if (FS.existsSync(ConfigPath)) {
            const userConfig = require(ConfigPath), validConfigs = Object.keys(Config), parsedConfigs = Object.keys(userConfig), parsedSettings = Object.keys(userConfig.Settings), invalidConfigs = parsedConfigs.filter((config => !validConfigs.includes(config))), validSettings = Object.keys(Config.Settings);
            UnknownSettings = parsedSettings.filter((setting => !validSettings.includes(setting)));
            invalidConfigs.forEach((config => {
                console.warn(`unknown config in config.js: [33m${config}[0m`);
            }));
            UnknownSettings.forEach((setting => {
                console.warn(`unknown setting in config.js: [33mSettings.${setting}[0m`);
            }));
            const missingConfigs = validConfigs.filter((config => !parsedConfigs.includes(config))), missingSettings = validSettings.filter((config => !parsedSettings.includes(config)));
            missingConfigs.forEach((config => {
                console.warn(`adding missing config in config.js: [33m${config}[0m`);
                userConfig[config] = Config[config];
            }));
            missingSettings.forEach((setting => {
                console.warn(`adding missing setting in config.js: [33mSettings.${setting}[0m`);
                userConfig.Settings[setting] = Config.Settings[setting];
            }));
            ChangedSettings = parsedSettings.filter((setting => Config.Settings[setting] !== userConfig.Settings[setting]));
            (missingConfigs.length > 0 || missingSettings.length > 0) && await writeSettings(userConfig);
            userConfig.Settings.LogMessages && (Logger = require('fs').createWriteStream(LogPath));
            Config = {
                ...Config,
                ...userConfig
            };
        } else {
            Config.Cookie = 'SET YOUR COOKIE HERE';
            writeSettings(Config, true);
        }
    })();
    Proxy.listen(Config.Port, Config.Ip, onListen);
    Proxy.on('error', (err => {
        console.error('Proxy error\n%o', err);
    }));
}();

const cleanup = async () => {
    console.log('cleaning...');
    try {
        await deleteChat(Conversation.uuid);
        Logger?.close();
        Superfetch?.exit((() => {
            process.exit();
        }));
    } catch (err) {
        process.exit();
    }
};

process.on('SIGHUP', cleanup);

process.on('SIGTERM', cleanup);

process.on('SIGINT', cleanup);

process.on('exit', (async () => {
    console.log('exiting...');
}));