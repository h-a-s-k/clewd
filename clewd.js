/*
* https://rentry.org/teralomaniac_clewd
* https://github.com/teralomaniac/clewd
*/
'use strict';

const {createServer: Server, IncomingMessage, ServerResponse} = require('node:http');

const {createHash: Hash, randomUUID, randomInt, randomBytes} = require('node:crypto');

const {TransformStream} = require('node:stream/web');

const {Readable, Writable} = require('node:stream');

const FS = require('node:fs');

const Path = require('node:path');
const { config } = require('node:process');

const Decoder = new TextDecoder;

const Encoder = new TextEncoder;

let ChangedSettings;

let UnknownSettings;

let Logger;

const ConfigPath = Path.join(__dirname, './config.js');

const LogPath = Path.join(__dirname, './log.txt');

const Replacements = {
    user: 'Human: ',
    assistant: 'Assistant: ',
    system: '',
    example_user: 'H: ',
    example_assistant: 'A: '
};

const DangerChars = [ ...new Set([ ...Object.values(Replacements).join(''), ...'\n', ...'\\n' ]) ].filter((char => ' ' !== char)).sort();

const Conversation = {
    char: null,
    uuid: null,
    depth: 0
};

const cookies = {};

let curPrompt = {};

let prevPrompt = {};

let prevMessages = [];

let prevImpersonated = false;

let uuidOrg;

/******************************************************* */
let currentIndex = 0;

const events = require('events');
const CookieChanger = new events.EventEmitter();

CookieChanger.on('ChangeCookie', () => {
    Proxy && Proxy.close();
    console.log('\nChanging Cookie...\n');
    Proxy.listen(Config.Port, Config.Ip, onListen);
    Proxy.on('error', (err => {
        console.error('Proxy error\n%o', err);
    }));
});

const padJson = (json) => {
    if (Config.padtxt_placeholder.length > 0){
        var placeholder = Config.padtxt_placeholder;
    }
    else {
        const bytes = randomInt(5, 15);
        var placeholder = randomBytes(bytes).toString('hex');
    }
    
    var sizeInBytes = new Blob([json]).size; // 计算json数据的字节大小

    // 计算需要添加的占位符数量, 注意你需要注意到UTF-8编码中中文字符占3字节
    var count = Math.floor((32000 - sizeInBytes) / new Blob([placeholder]).size); 

    // 生成占位符字符串
    var padding = '';
    for (var i = 0; i < count; i++) {
        padding += placeholder;
    }

    // 在json前面添加占位符, 在末尾增加空行然后添加json
    var result = padding + '\n\n\n' + json;

    result = result.replace(/^\s*/, '');

    return result
};

const AddxmlPlot = (content) => {
    // 检查内容中是否包含"<card>","[Start a new"字符串
    if (!content.includes('<card>')) {
        return content;
    }

    content = content.replace(/\[Start a new chat\]/gm, '\n[Start a new chat]');
    content = content.replace(/\n\nSystem:\s*/g, '\n\n');

    // 在第一个"[Start a new"前面加上"<example>"，在最后一个"[Start a new"前面加上"</example>"
    let firstChatStart = content.indexOf('\n\n[Start a new');
    let lastChatStart = content.lastIndexOf('\n\n[Start a new');
    if (firstChatStart != -1) { 
        content = content.slice(0, firstChatStart) + '\n\n</card>\n\n<example>' + 
                content.slice(firstChatStart, lastChatStart) + '\n\n</example>' + 
                content.slice(lastChatStart);
    }
        
    // 之后的第一个"Assistant: "之前插入"\n\n<plot>"
    let lastChatIndex = content.lastIndexOf('\n\n[Start a new');
    if (lastChatIndex != -1 && content.includes('</plot>')) { 
        let assistantIndex = content.indexOf('\n\nAssistant:', lastChatIndex);
        if (assistantIndex != -1) {
            content = content.slice(0, assistantIndex) + '\n\n<plot>' + content.slice(assistantIndex);
        }
    }
  
    let sexMatch = content.match(/\n##.*?\n<sex>[\s\S]*?<\/sex>\n/);
    let deleteMatch = content.match(/\n##.*?\n<delete>[\s\S]*?<\/delete>\n/);
  
    if (sexMatch && deleteMatch) {
        content = content.replace(sexMatch[0], ""); // 移除<sex>部分
        content = content.replace(deleteMatch[0], sexMatch[0] + deleteMatch[0]); // 将<sex>部分插入<delete>部分的前面
    }

    let illustrationMatch = content.match(/\n##.*?\n<illustration>[\s\S]*?<\/illustration>\n/);

    if (illustrationMatch && deleteMatch) {
        content = content.replace(illustrationMatch[0], ""); // 移除<illustration>部分
        content = content.replace(deleteMatch[0], illustrationMatch[0] + deleteMatch[0]); // 将<illustration>部分插入<delete>部分的前面
    }

    content = content.replace(/\n\n<(hidden|\/plot)>[\s\S]*?\n\n<extra_prompt>\s*/, '\n\nHuman:'); //sd prompt用

    //消除空XML tags或多余的\n
    content = content.replace(/(?<=\n<(card|hidden|example)>\n)\s*/g, '');
    content = content.replace(/\s*(?=\n<\/(card|hidden|example)>(\n|$))/g, '');
    content = content.replace(/\n\n<(example|hidden)>\n<\/\1>/g, '');

    return content
};
/******************************************************* */
/**
 * Edit settings in your config.js instead
 * these are the defaults and change every update
 * @preserve
 */ let Config = {
    Cookie: '',
    CookieArray: [],
    Ip: process.env.PORT ? '0.0.0.0' : '127.0.0.1',
    Port: process.env.PORT || 8444,
    BufferSize: 1,
    SystemInterval: 3,
    padtxt_placeholder: '',
    Settings: {
        PreventImperson: false,
        PromptExperiments: true,
        RetryRegenerate: false,
        RenewAlways: true,
        SystemExperiments: true,
        AllSamples: false,
        NoSamples: false,
        StripAssistant: false,
        StripHuman: false,
        PassParams: false,
        ClearFlags: true,
        PreserveChats: true,
        LogMessages: true,
        FullColon: true,
        padtxt: true,
        xmlPlot: true,
        localtunnel: false,       
        VPNfree: false
    },
    PersonalityFormat: '{{CHAR}}\'s personality: {{PERSONALITY}}',
    ScenarioFormat: 'Dialogue scenario: {{SCENARIO}}'
};

const Main = 'clewd v3.4修改版 by tera';
/******************************************************* */

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
    end: () => Config.Settings.VPNfree ? Buffer.from([ 104, 116, 116, 112, 115, 58, 47, 47, 99, 104, 97, 116, 46, 99, 108, 97, 117, 100, 101, 97, 105, 46, 97, 105 ]).toString() : Buffer.from([ 104, 116, 116, 112, 115, 58, 47, 47, 99, 108, 97, 117, 100, 101, 46, 97, 105 ]).toString(),
    modelA: () => Buffer.from([ 99, 108, 97, 117, 100, 101, 45, 50 ]).toString(),
    modelB: () => Buffer.from([ 99, 108, 97, 117, 100, 101, 45, 105, 110, 115, 116, 97, 110, 116, 45, 49 ]).toString(),
    agent: () => JSON.parse(Buffer.from([ 91, 34, 77, 111, 122, 105, 108, 108, 97, 47, 53, 46, 48, 32, 40, 87, 105, 110, 100, 111, 119, 115, 32, 78, 84, 32, 49, 48, 46, 48, 59, 32, 87, 105, 110, 54, 52, 59, 32, 120, 54, 52, 41, 32, 65, 112, 112, 108, 101, 87, 101, 98, 75, 105, 116, 47, 53, 51, 55, 46, 51, 54, 32, 40, 75, 72, 84, 77, 76, 44, 32, 108, 105, 107, 101, 32, 71, 101, 99, 107, 111, 41, 32, 67, 104, 114, 111, 109, 101, 47, 49, 49, 53, 46, 48, 46, 48, 46, 48, 32, 83, 97, 102, 97, 114, 105, 47, 53, 51, 55, 46, 51, 54, 32, 69, 100, 103, 47, 49, 49, 53, 46, 48, 46, 49, 57, 48, 49, 46, 49, 56, 56, 34, 44, 34, 77, 111, 122, 105, 108, 108, 97, 47, 53, 46, 48, 32, 40, 87, 105, 110, 100, 111, 119, 115, 32, 78, 84, 32, 49, 48, 46, 48, 59, 32, 87, 105, 110, 54, 52, 59, 32, 120, 54, 52, 41, 32, 65, 112, 112, 108, 101, 87, 101, 98, 75, 105, 116, 47, 53, 51, 55, 46, 51, 54, 32, 40, 75, 72, 84, 77, 76, 44, 32, 108, 105, 107, 101, 32, 71, 101, 99, 107, 111, 41, 32, 67, 104, 114, 111, 109, 101, 47, 49, 49, 53, 46, 48, 46, 48, 46, 48, 32, 83, 97, 102, 97, 114, 105, 47, 53, 51, 55, 46, 51, 54, 34, 44, 34, 77, 111, 122, 105, 108, 108, 97, 47, 53, 46, 48, 32, 40, 87, 105, 110, 100, 111, 119, 115, 32, 78, 84, 32, 49, 48, 46, 48, 59, 32, 87, 105, 110, 54, 52, 59, 32, 120, 54, 52, 59, 32, 114, 118, 58, 49, 48, 57, 46, 48, 41, 32, 71, 101, 99, 107, 111, 47, 50, 48, 49, 48, 48, 49, 48, 49, 32, 70, 105, 114, 101, 102, 111, 120, 47, 49, 49, 54, 46, 48, 34, 44, 34, 77, 111, 122, 105, 108, 108, 97, 47, 53, 46, 48, 32, 40, 87, 105, 110, 100, 111, 119, 115, 32, 78, 84, 32, 49, 48, 46, 48, 59, 32, 87, 105, 110, 54, 52, 59, 32, 120, 54, 52, 41, 32, 65, 112, 112, 108, 101, 87, 101, 98, 75, 105, 116, 47, 53, 51, 55, 46, 51, 54, 32, 40, 75, 72, 84, 77, 76, 44, 32, 108, 105, 107, 101, 32, 71, 101, 99, 107, 111, 41, 32, 67, 104, 114, 111, 109, 101, 47, 49, 49, 53, 46, 48, 46, 48, 46, 48, 32, 83, 97, 102, 97, 114, 105, 47, 53, 51, 55, 46, 51, 54, 32, 79, 80, 82, 47, 49, 48, 50, 46, 48, 46, 48, 46, 48, 34, 93 ]).toString()).sample(),
    hdr: () => ({
        'Content-Type': 'application/json',
        Referer: AI.end() + '/',
        Origin: '' + AI.end()
    })
};

const fileName = () => {
    const len = randomInt(5, 15);
    let name = randomBytes(len).toString('hex');
    for (let i = 0; i < name.length; i++) {
        const char = name.charAt(i);
        isNaN(char) && randomInt(1, 5) % 2 == 0 && ' ' !== name.charAt(i - 1) && (name = name.slice(0, i) + ' ' + name.slice(i));
    }
    return name + '.txt';
};

const bytesToSize = (bytes = 0) => {
    const b = [ 'B', 'KB', 'MB', 'GB', 'TB' ];
    if (0 === bytes) {
        return '0 B';
    }
    const c = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), 4);
    return 0 === c ? `${bytes} ${b[c]}` : `${(bytes / 1024 ** c).toFixed(1)} ${b[c]}`;
};

const genericFixes = text => text.replace(/(\r\n|\r|\\n)/gm, '\n');

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
    const res = await fetch(`${AI.end()}/api/organizations/${uuidOrg}/chat_conversations/${uuid}`, {
        headers: {
            ...AI.hdr(),
            Cookie: getCookies()
        },
        method: 'DELETE'
    });
    updateCookies(res);
};

const setTitle = title => {
    title = `${Main} - ${title}`;
    process.title !== title && (process.title = title);
};

const onListen = async () => {
/***************************** */
    if (Config.CookieArray.length > 0) {
        currentIndex = (currentIndex + 1) % Config.CookieArray.length;
        Config.Cookie = Config.CookieArray[currentIndex];
    }
/***************************** */
    if ('SET YOUR COOKIE HERE' === Config.Cookie || Config.Cookie?.length < 1) {
        throw Error('Set your cookie inside config.js');
    }
    const accRes = await fetch(AI.end() + '/api/organizations', {
        method: 'GET',
        headers: {
            ...AI.hdr(),
            Cookie: Config.Cookie
        }
    });
    const accInfo = (await accRes.json())?.[0];
    if (!accInfo || accInfo.error) {
/**************************** */
        if (accRes.statusText === 'Forbidden' && Config.CookieArray.length > 0){
            Config.CookieArray = Config.CookieArray.filter(item => item !== Config.Cookie);
            writeSettings(Config);
            return CookieChanger.emit('ChangeCookie');
        }
/**************************** */
        throw Error(`Couldn't get account info: "${accInfo?.error?.message || accRes.statusText}"`);
    }
    if (!accInfo?.uuid) {
        throw Error('Invalid account id');
    }
    setTitle('ok');
    updateCookies(Config.Cookie);
    updateCookies(accRes);
    await checkResErr(accRes);
    console.log(`[2m${Main}[0m\n[33mhttp://${Config.Ip}:${Config.Port}/v1[0m\n\n${Object.keys(Config.Settings).map((setting => UnknownSettings.includes(setting) ? `??? [31m${setting}: ${Config.Settings[setting]}[0m` : `[1m${setting}:[0m ${ChangedSettings.includes(setting) ? '[33m' : '[36m'}${Config.Settings[setting]}[0m`)).sort().join('\n')}\n`);
/*******************************/    
    if (Config.Settings.localtunnel) {
        const localtunnel = require('localtunnel');
        localtunnel({ port: Config.Port })
        .then((tunnel) => {
            console.log(`\nTunnel URL for outer websites: ${tunnel.url}/v1\n`);
        })
    }
/*******************************/
    console.log('Logged in %o', {
        name: accInfo.name?.split('@')?.[0],
        capabilities: accInfo.capabilities
    });
    uuidOrg = accInfo?.uuid;
    if (accInfo?.active_flags.length > 0) {
        const now = new Date;
        const formattedFlags = accInfo.active_flags.map((flag => {
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
            const req = await fetch(`${AI.end()}/api/organizations/${uuidOrg}/flags/${type}/dismiss`, {
                headers: {
                    ...AI.hdr(),
                    Cookie: getCookies()
                },
                method: 'POST'
            });
            updateCookies(req);
            const json = await req.json();
            console.log(`${type}: ${json.error ? json.error.message || json.error.type || json.detail : 'OK'}`);
        })(flag.type))));
/***************************** */
        CookieChanger.emit('ChangeCookie');
/***************************** */
    }
    const convRes = await fetch(`${AI.end()}/api/organizations/${uuidOrg}/chat_conversations`, {
        method: 'GET',
        headers: {
            ...AI.hdr(),
            Cookie: getCookies()
        }
    });
    const conversations = await convRes.json();
    updateCookies(convRes);
    conversations.length > 0 && await Promise.all(conversations.map((conv => deleteChat(conv.uuid))));
};

const checkResErr = async res => {
    if (res.status < 200 || res.status >= 300) {
        let err = Error('Unexpected response code: ' + res.status);
        err.planned = true;
        try {
            const json = await res.json();
            if (json.error) {
                if (json.error.message.includes('read-only mode')) {
                    Config.CookieArray = Config.CookieArray.filter(item => item !== Config.Cookie);
                    writeSettings(Config);
                    CookieChanger.emit('ChangeCookie');
                }
                else if (json.error.message.includes('Exceeded completions limit')) {
                    CookieChanger.emit('ChangeCookie');
                }
            }
            const {error: errAPI} = json;
            if (errAPI) {
                errAPI.message && (err.message = errAPI.message);
                errAPI.type && (err.type = errAPI.type);
                if (429 === res.status && errAPI.resets_at) {
                    const hours = ((new Date(1e3 * errAPI.resets_at).getTime() - Date.now()) / 1e3 / 60 / 60).toFixed(2);
                    err.message += `, expires in ${hours} hours`;
                }
            }
        } catch (err) {}
        throw Error(err);
    }
};

class ClewdStream extends TransformStream {
    constructor(minSize = 8, modelName = AI.modelA(), streaming, abortController) {
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
        const valid = [ ...this.#compOK ];
        const selection = valid.splice(0, Math.min(this.#minSize, valid.length)).join('');
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
        330 === this.#recvLength && (this.#hardCensor = true);
        if (this.#streaming) {
            this.#compOK.length > 0 && controller.enqueue(this.#build(this.#compOK));
            controller.enqueue('[DONE]');
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
            })(text, last);
            const fakeAssistant = ((text, last = false) => {
                let location = -1;
                const matchesA = text.match(/(?:(?:\\n)|\n){2}((?:Assistant|A): ?)/gm);
                matchesA?.length > 0 && (location = last ? text.lastIndexOf(matchesA[matchesA.length - 1]) : text.indexOf(matchesA[0]));
                return location;
            })(text, last);
            const fakes = [ fakeHuman, fakeAssistant ].filter((idx => idx > -1)).sort();
            location = last ? fakes.reverse()[0] : fakes[0];
            return isNaN(location) ? -1 : location;
        })(reply);
        if (fakeAny > -1) {
            this.#impersonated = true;
            if (Config.Settings.PreventImperson) {
                const selection = reply.substring(0, fakeAny);
                console.warn(`[33mimpersonation, dropped:[0m "[4m${reply.substring(fakeAny, reply.length).replace(/\n/g, '\\n')}[0m..."`);
                controller.enqueue(this.#build(selection));
                this.#streaming && controller.enqueue('[DONE]');
                this.#print();
                this.#abortController.abort();
                return controller.terminate();
            }
        }
    }
    #parseMatch(match, controller) {
        let parsed;
        let delayChunk;
        try {
            parsed = JSON.parse(match);
            if (parsed.error) {
                console.warn(`[31m${this.#modelName}: ${parsed.error}[0m`);
                parsed.completion = `## ${Main}\n**${this.#modelName}**:\n\`\`\`${JSON.stringify(parsed.error)}\`\`\``;
            }
            this.#compAll.push(parsed.completion);
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
        this.#recvLength += chunk.byteLength || 0;
        chunk = Decoder.decode(chunk).replace(/^data: {/gim, '{').replace(/\s+$/gim, '');
        this.#compRaw += chunk;
        const matches = this.#compRaw.split(/(\n){1}/gm).filter((match => match.length > 0 && '\n' !== match));
        for (const match of matches) {
            this.#parseMatch(match, controller);
        }
    }
}

const writeSettings = async (config, firstRun = false) => {
    FS.writeFileSync(ConfigPath, `/*\n* https://rentry.org/teralomaniac_clewd\n* https://github.com/teralomaniac/clewd\n*/\n\n// SET YOUR COOKIE BELOW\n\nmodule.exports = ${JSON.stringify(config, null, 4)}\n\n/*\n BufferSize\n * How many characters will be buffered before the AI types once\n * lower = less chance of \`PreventImperson\` working properly\n\n ---\n\n SystemInterval\n * How many messages until \`SystemExperiments alternates\`\n\n ---\n\n Other settings\n * https://gitgud.io/ahsk/clewd/#defaults\n * and\n * https://gitgud.io/ahsk/clewd/-/blob/master/CHANGELOG.md\n */`.trim().replace(/((?<!\r)\n|\r(?!\n))/g, '\r\n'));
    if (firstRun) {
        console.warn('[33mConfig file created!\nedit[0m [1mconfig.js[0m [33mto set your settings and restart the program[0m');
        process.exit(0);
    }
};

const Proxy = Server((async (req, res) => {
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
        res.json({
            data: [ {
                id: AI.modelA()
            } ]
        });
        break;

      case '/v1/chat/completions':
        ((req, res) => {
            setTitle('recv...');
            let fetchAPI;
            const controller = new AbortController;
            const {signal} = controller;
            res.socket.on('close', (async () => {
                controller.signal.aborted || controller.abort();
            }));
            const buffer = [];
            req.on('data', (chunk => {
                buffer.push(chunk);
            }));
            req.on('end', (async () => {
                let clewdStream;
                let titleTimer;
                let samePrompt = false;
                let shouldRenew = true;
                let retryRegen = false;
                try {
                    const body = JSON.parse(Buffer.concat(buffer).toString());
                    const temperature = Math.max(.1, Math.min(1, body.temperature));
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
                    const model = AI.modelA();
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
                            const res = await fetch(AI.end() + '/api/retry_message', {
                                signal,
                                headers: {
                                    ...AI.hdr(),
                                    Cookie: getCookies()
                                },
                                method: 'POST',
                                body: JSON.stringify({
                                    completion: {
                                        prompt: '',
                                        timezone: 'America/New_York',
                                        model
                                    },
                                    organization_uuid: uuidOrg,
                                    conversation_uuid: Conversation.uuid,
                                    text: ''
                                })
                            });
                            updateCookies(res);
                            await checkResErr(res);
                            return res;
                        })(signal, 0, model);
                    } else if (shouldRenew) {
                        Conversation.uuid && await deleteChat(Conversation.uuid);
                        fetchAPI = await (async signal => {
                            Conversation.uuid = randomUUID().toString();
                            Conversation.depth = 0;
                            const res = await fetch(`${AI.end()}/api/organizations/${uuidOrg}/chat_conversations`, {
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
                            updateCookies(res);
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
                        const rgxScenario = /^\[Circumstances and context of the dialogue: ([\s\S]+?)\.?\]$/i;
                        const rgxPerson = /^\[([\s\S]+?)'s personality: ([\s\S]+?)\]$/i;
                        const messagesClone = JSON.parse(JSON.stringify(messages));
                        const realLogs = messagesClone.filter((message => [ 'user', 'assistant' ].includes(message.role)));
                        const sampleLogs = messagesClone.filter((message => [ 'example_user', 'example_assistant' ].includes(message.name)));
                        const mergedLogs = [ ...sampleLogs, ...realLogs ];
                        mergedLogs.forEach(((message, idx) => {
                            const next = realLogs[idx + 1];
                            if (next) {
                                if (message.name && next.name && message.name === next.name) {
                                    message.content += '\n' + next.content;
                                    next.merged = true;
                                } else if (next.role === message.role) {
                                    message.content += '\n' + next.content;
                                    next.merged = true;
                                }
                            }
                        }));
                        const lastAssistant = realLogs.findLast((message => !message.merged && 'assistant' === message.role));
                        lastAssistant && Config.Settings.StripAssistant && (lastAssistant.strip = true);
                        const lastUser = realLogs.findLast((message => !message.merged && 'user' === message.role));
                        lastUser && Config.Settings.StripHuman && (lastUser.strip = true);
                        const systemMessages = messagesClone.filter((message => 'system' === message.role && !message.name));
                        systemMessages.forEach(((message, idx) => {
                            const scenario = message.content.match(rgxScenario)?.[1];
                            const personality = message.content.match(rgxPerson);
                            if (scenario) {
                                message.content = Config.ScenarioFormat.replace(/{{SCENARIO}}/g, scenario);
                                message.scenario = true;
                            }
                            if (3 === personality?.length) {
                                message.content = Config.PersonalityFormat.replace(/{{CHAR}}/gm, personality[1]).replace(/{{PERSONALITY}}/gm, personality[2]);
                                message.personality = true;
                            }
                            message.main = 0 === idx;
                            message.jailbreak = idx === systemMessages.length - 1;
                        }));
                        Config.Settings.AllSamples && !Config.Settings.NoSamples && realLogs.forEach((message => {
                            if ('user' === message.role) {
                                message.name = 'example_user';
                                message.role = 'system';
                            } else {
                                if ('assistant' !== message.role) {
                                    throw Error('Invalid role ' + message.role);
                                }
                                message.name = 'example_assistant';
                                message.role = 'system';
                            }
                        }));
                        Config.Settings.NoSamples && !Config.Settings.AllSamples && sampleLogs.forEach((message => {
                            if ('example_user' === message.name) {
                                message.role = 'user';
                            } else {
                                if ('example_assistant' !== message.name) {
                                    throw Error('Invalid role ' + message.name);
                                }
                                message.role = 'assistant';
                            }
                            delete message.name;
                        }));
                        let systems = [];
                        if (![ 'r', 'R' ].includes(type)) {
                            lastUser.strip = true;
                            systemMessages.forEach((message => message.discard = message.discard || 'c-c' === type ? !message.jailbreak : !message.jailbreak && !message.main));
                            systems = systemMessages.filter((message => !message.discard)).map((message => `"${message.content.substring(0, 25).replace(/\n/g, '\\n').trim()}..."`));
                            messagesClone.forEach((message => message.discard = message.discard || mergedLogs.includes(message) && ![ lastUser ].includes(message)));
                        }
                        const prompt = messagesClone.map(((message, idx) => {
                            if (message.merged || message.discard) {
                                return '';
                            }
                            if (message.content.length < 1) {
                                return message.content;
                            }
                            let spacing = '';
                            idx > 0 && (spacing = systemMessages.includes(message) ? '\n' : '\n\n');
                            return `${spacing}${message.strip ? '' : Replacements[message.name || message.role]}${message.content.trim()}`;
                        }));
                        return {
                            prompt: genericFixes(prompt.join('')).trim(),
                            systems
                        };
                    })(messages, type);
                    console.log(`${model} [[2m${type}[0m]${!retryRegen && systems.length > 0 ? ' ' + systems.join(' [33m/[0m ') : ''}`);
/****************************************************************/
                    if (Config.Settings.xmlPlot) {prompt = AddxmlPlot(prompt)};
                    if (Config.Settings.FullColon) {prompt = prompt.replace(/(?<=\n\n(H(?:uman)?|A(?:ssistant)?)):[ ]?/g, '：')};
                    if (Config.Settings.padtxt) {prompt = padJson(prompt)};
/****************************************************************/
                    retryRegen || (fetchAPI = await (async (signal, body, model, prompt, temperature) => {
                        const attachments = [];
                        if (Config.Settings.PromptExperiments) {
                            attachments.push({
                                extracted_content: (prompt),
                                file_name: 'paste.txt',  //fileName(),
                                file_size: Buffer.from(prompt).byteLength,
                                file_type: 'txt'  //'text/plain'
                            });
                            prompt = '';
                        }
                        const res = await fetch(AI.end() + '/api/append_message', {
                            signal,
                            headers: {
                                ...AI.hdr(),
                                Cookie: getCookies()
                            },
                            method: 'POST',
                            body: JSON.stringify({
                                completion: {
                                    ...Config.Settings.PassParams && {
                                        temperature
                                    },
                                    prompt,
                                    timezone: 'Europe/London',
                                    model
                                },
                                organization_uuid: uuidOrg,
                                conversation_uuid: Conversation.uuid,
                                text: prompt,
                                attachments
                            })
                        });
                        updateCookies(res);
                        await checkResErr(res);
                        return res;
                    })(signal, 0, model, prompt, temperature));
                    const response = Writable.toWeb(res);
                    'R' !== type || prompt || (prompt = '...regen...');
                    Logger?.write(`\n\n-------\n[${(new Date).toLocaleString()}]\n####### PROMPT (${type}):\n${prompt}\n--\n####### REPLY:\n`);
                    clewdStream = new ClewdStream(Config.BufferSize, model, body.stream, controller);
                    titleTimer = setInterval((() => setTitle('recv ' + bytesToSize(clewdStream.size))), 300);
                    await fetchAPI.body.pipeThrough(clewdStream).pipeTo(response);
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
                    clearInterval(titleTimer);
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
        }, 200);
    }
}));

!async function() {
    await (async () => {
        if (FS.existsSync(ConfigPath)) {
            const userConfig = require(ConfigPath);
            const validConfigs = Object.keys(Config);
            const parsedConfigs = Object.keys(userConfig);
            const parsedSettings = Object.keys(userConfig.Settings);
            const invalidConfigs = parsedConfigs.filter((config => !validConfigs.includes(config)));
            const validSettings = Object.keys(Config.Settings);
            UnknownSettings = parsedSettings.filter((setting => !validSettings.includes(setting)));
            invalidConfigs.forEach((config => {
                console.warn(`unknown config in config.js: [33m${config}[0m`);
            }));
            UnknownSettings.forEach((setting => {
                console.warn(`unknown setting in config.js: [33mSettings.${setting}[0m`);
            }));
            const missingConfigs = validConfigs.filter((config => !parsedConfigs.includes(config)));
            const missingSettings = validSettings.filter((config => !parsedSettings.includes(config)));
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
/***************************** */
        for (let key in Config) {
            if (key === 'Settings') {
                for (let setting in Config.Settings) {
                    Config.Settings[setting] = process.env[setting] ?? Config.Settings[setting];
                }
            } else {
                Config[key] = key === 'CookieArray' ? (process.env[key]?.split(',') ?? Config[key]) : (process.env[key] ?? Config[key]);
            }
        }
/***************************** */
    })();
    currentIndex = Math.floor(Math.random() * Config.CookieArray.length);
    Proxy.listen(Config.Port, Config.Ip, onListen);
    Proxy.on('error', (err => {
        console.error('Proxy error\n%o', err);
    }));
}();

process.on('SIGINT', (async () => {
    console.log('cleaning...');
    try {
        await deleteChat(Conversation.uuid);
        Logger?.close();
    } catch (err) {}
    process.exit(0);
}));

process.on('exit', (async () => {
    console.log('exiting...');
}));