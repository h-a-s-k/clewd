/**
 * SET YOUR COOKIE HERE
 * @preserve
 */
const Cookie = '';




/**
## EXPERIMENTAL

### SettingName: (DEFAULT)/opt1/opt2

 1. AntiStall: (false)/1/2
    * pretty much useless when using streaming
    * 1 sends whatever was last when exceeding size (might send empty reply)
    * 2 returns the second reply by the assistant (the first is usually an apology)

 2. ClearFlags: (false)
    * possibly snake-oil

 3. RecycleChats: (false)
    * false is less likely to get caught in a censorship loop

 4. StripAssistant: (false)
    * might be good if your prompt/jailbreak itself ends with Assistant: 

 5. StripHuman: (false) 
    * bad idea without RecycleChats, sends only your very last message
 * @preserve
 */ const Settings = {
    'AntiStall': false,
    'ClearFlags': false,
    'RecycleChats': false,
    'StripAssistant': false,
    'StripHuman': false
};

const Ip = '127.0.0.1';
const Port = 8444;

/**
 * Don't touch StallTriggerMax.
 * If you know what you're doing, change the 2 MB on StallTrigger to what you want
 * @preserve
 */ const StallTriggerMax = 5242880;

const StallTrigger = 2097152;

const {'createServer': Server} = require('node:http');
const {'createHash': Hash} = require('node:crypto');
const {'v4': genUUID} = require('uuid');
const Decoder = new TextDecoder;
const Encoder = new TextEncoder;

const UUIDMap = {};
const cookies = {};
let uuidTemp;
let uuidOrg;

const AI = {
    'endPoint': () => Buffer.from([ 104, 116, 116, 112, 115, 58, 47, 47, 99, 108, 97, 117, 100, 101, 46, 97, 105 ]).toString(),
    'modelA': () => Buffer.from([ 99, 108, 97, 117, 100, 101, 45, 50 ]).toString(),
    'modelB': () => Buffer.from([ 99, 108, 97, 117, 100, 101, 45, 105, 110, 115, 116, 97, 110, 116, 45, 49 ]).toString(),
    'agent': () => Buffer.from([ 77, 111, 122, 105, 108, 108, 97, 47, 53, 46, 48, 32, 40, 87, 105, 110, 100, 111, 119, 115, 32, 78, 84, 32, 49, 48, 46, 48, 59, 32, 87, 105, 110, 54, 52, 59, 32, 120, 54, 52, 41, 32, 65, 112, 112, 108, 101, 87, 101, 98, 75, 105, 116, 47, 53, 51, 55, 46, 51, 54, 32, 40, 75, 72, 84, 77, 76, 44, 32, 108, 105, 107, 101, 32, 71, 101, 99, 107, 111, 41, 32, 67, 104, 114, 111, 109, 101, 47, 49, 49, 52, 46, 48, 46, 48, 46, 48, 32, 83, 97, 102, 97, 114, 105, 47, 53, 51, 55, 46, 51, 54, 32, 69, 100, 103, 47, 49, 49, 52, 46, 48, 46, 49, 56, 50, 51, 46, 55, 57 ]).toString()
};

const getCookies = () => Object.keys(cookies).map((name => `${name}=${cookies[name]};`)).join(' ').replace(/(\s+)$/gi, '');

const bytesToSize = (bytes = 0) => {
    const b = [ 'Bytes', 'KB', 'MB', 'GB', 'TB' ];
    if (0 === bytes) {
        return '0 B';
    }
    const c = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), 4);
    return 0 === c ? `${bytes} ${b[c]}` : `${(bytes / 1024 ** c).toFixed(1)} ${b[c]}`;
};

const stallProtected = () => [ '1', '2' ].includes(Settings.AntiStall + '');

const updateCookies = (cookieInfo, initial = false) => {
    let cookieNew = initial ? cookieInfo : cookieInfo.headers?.get('set-cookie');
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

const setTitle = title => {
    process.title = 'clewd v1.5 - ' + title;
};

const Proxy = Server(((req, res) => {
    if ('/v1/complete' !== req.url) {
        return res.writeHead(404, {
            'Content-Type': 'application/json'
        }).end(JSON.stringify({
            'error': {
                'message': '404 Not Found',
                'type': 404,
                'param': null,
                'code': 500
            }
        }));
    }
    setTitle('recv...');
    let recvReader;
    const abortion = new AbortController;
    const {'signal': signal} = abortion;
    res.on('close', (async () => {
        if (!signal.aborted && false === await (recvReader?.closed)) {
            console.log('[31mabort[0m');
            abortion.abort();
        }
    }));
    const buffer = [];
    req.on('data', (chunk => {
        buffer.push(chunk);
    }));
    req.on('end', (async () => {
        try {
            const body = JSON.parse(Buffer.concat(buffer).toString());
            let {'prompt': prompt} = body;
            if (!body.stream && '\n\nHuman: \n\nHuman: Hi\n\nAssistant: ' === prompt) {
                return res.writeHead(200, {
                    'Content-Type': 'application/json'
                }).end(JSON.stringify({
                    'error': false
                }));
            }
            const model = /claude-v?2.*/.test(body.model) ? AI.modelA() : body.model;
            !Settings.RecycleChats && Settings.StripHuman && console.log('[33mhaving [1mStripHuman[0m without [1mRecycleChats[0m, not recommended[0m');
            model !== AI.modelA() && console.log(`[33mmodel[0m [1m${AI.modelA()}[0m [33mrecommended[0m`);
            if (stallProtected() && body.stream) {
                console.log('[33mwith streaming,[0m [1mAntiStall[0m [33mis disabled[0m');
                Settings.AntiStall = false;
            }
            /**
             * Ideally SillyTavern would expose a unique frontend conversation_uuid prop to localhost proxies
             * could set the name to a hash of it
             * then fetch /chat_conversations with 'GET' and find it
             * @preserve
             */            const firstAssistantIdx = prompt.indexOf('\n\nAssistant: ');
            const hash = Hash('sha1');
            hash.update(prompt.substring(0, firstAssistantIdx));
            const sha = Settings.RecycleChats ? hash.digest('hex') : '';
            const uuidOld = UUIDMap[sha];
            const lastHumanIdx = prompt.lastIndexOf('\n\nHuman: ');
            Settings.RecycleChats && Settings.StripHuman && uuidOld && lastHumanIdx > -1 && (prompt = prompt.substring(lastHumanIdx, prompt.length));
            const lastAssistantIdx = prompt.lastIndexOf('\n\nAssistant: ');
            Settings.StripAssistant && lastAssistantIdx > -1 && (prompt = prompt.substring(0, lastAssistantIdx));
            if (Settings.RecycleChats && uuidOld) {
                uuidTemp = uuidOld;
                console.log(model + ' r');
            } else {
                uuidTemp = genUUID().toString();
                const fetchAPI = await fetch(`${AI.endPoint()}/api/organizations/${uuidOrg}/chat_conversations`, {
                    'signal': signal,
                    'headers': {
                        'Cookie': getCookies(),
                        'Content-Type': 'application/json'
                    },
                    'method': 'POST',
                    'body': JSON.stringify({
                        'uuid': uuidTemp,
                        'name': sha
                    })
                });
                updateCookies(fetchAPI);
                console.log('' + model);
                UUIDMap[sha] = uuidTemp;
            }
            let recvStalled;
            let recvLength = 0;
            let validChunk;
            let recvBuffer = [];
            const fetchAPI = await fetch(AI.endPoint() + '/api/append_message', {
                'signal': signal,
                'headers': {
                    'Cookie': getCookies(),
                    'Content-Type': 'application/json'
                },
                'method': 'POST',
                'body': JSON.stringify({
                    'completion': {
                        'incremental': true === body.stream,
                        'prompt': prompt,
                        'timezone': 'America/New_York',
                        'model': model
                    },
                    'organization_uuid': uuidOrg,
                    'conversation_uuid': uuidTemp,
                    'text': prompt,
                    'attachments': []
                })
            });
            updateCookies(fetchAPI);
            recvReader = fetchAPI.body?.getReader();
            do {
                const {'done': done, 'value': chunk} = await recvReader.read();
                recvLength += chunk?.length || 0;
                setTitle(`recv ${body.stream ? '(s)' : ''} ${bytesToSize(recvLength)}`);
                if (validChunk) {
                    break;
                }
                if (null != chunk) {
                    body.stream && res.write(chunk);
                    recvBuffer.push(chunk);
                }
                if (done) {
                    330 === recvLength && console.log('[33mpossible hard-censor[0m');
                    break;
                }
                recvStalled = !validChunk && recvLength >= StallTrigger;
                if (stallProtected() && recvStalled) {
                    try {
                        const triggerEmergency = recvLength >= Math.min(StallTriggerMax, 2 * StallTrigger);
                        if (Settings.AntiStall + '' == '1' || triggerEmergency) {
                            console.log(`[31mstall: ${triggerEmergency ? 'max' : '1'}[0m`);
                            abortion.abort('stall 1');
                            break;
                        }
                        const chunkFixed = Decoder.decode(chunk).replace(/^data: {/gi, '{').replace(/\s+$/, '');
                        const chunkParsed = JSON.parse(chunkFixed);
                        const secondCompletionAssistantIdx = chunkParsed.completion.indexOf('\n\nAssistant: ', chunkParsed.completion.indexOf('\n\nAssistant: ') + 1);
                        if (secondCompletionAssistantIdx < 0) {
                            throw Error('Invalid completion');
                        }
                        chunkParsed.completion = chunkParsed.completion.substring(secondCompletionAssistantIdx + 13, chunkParsed.completion.length);
                        const completionHumanIdx = chunkParsed.completion.indexOf('\n\nHuman: ');
                        if (completionHumanIdx < 0) {
                            throw Error('Invalid completion');
                        }
                        chunkParsed.completion = chunkParsed.completion.substring(0, completionHumanIdx);
                        chunkParsed.stop || (chunkParsed.stop = '\n\nHuman:');
                        validChunk = Encoder.encode(`data: ${JSON.stringify(chunkParsed)}\n\n`);
                        abortion.abort('stall 2');
                        console.log('[31mstall: 2[0m');
                        break;
                    } catch (err) {}
                }
            } while (!signal.aborted && !validChunk);
            Buffer.concat(recvBuffer);
            const lastChunk = recvBuffer.slice(-1)?.[0];
            const chosenChunk = validChunk || lastChunk;
            setTitle(`${fetchAPI.status}! ${bytesToSize(recvLength)}`);
            console.log(`${200 == fetchAPI.status ? '[32m' : '[33m'}${fetchAPI.status}![0m ${Math.round((chosenChunk?.length || 1) / recvLength * 100)}%\n`);
            if (200 !== fetchAPI.status) {
                res.writeHead(fetchAPI.status);
                res.write(Buffer.concat(recvBuffer));
                return res.end();
            }
            if (body.stream) {
                return res.end();
            }
            const chunkPlain = Decoder.decode(chosenChunk).replace(/^data: {/gi, '{').replace(/\s+$/, '');
            res.writeHead(200, {
                'Content-Type': 'application/json'
            }).end(chunkPlain);
        } catch (err) {
            if ('AbortError' === err.name) {
                return res?.end();
            }
            console.error('clewd API error:\n%o', err);
            res.writeHead(500, {
                'Content-Type': 'application/json'
            }).end(JSON.stringify({
                'error': {
                    'message': err.message || err.name,
                    'type': err.type || err.code || err.name,
                    'param': null,
                    'code': 500
                }
            }));
        }
    }));
}));

Proxy.listen(Port, Ip, (async () => {
    console.log(`[33mhttp://${Ip}:${Port}/v1[0m\n\n${Object.keys(Settings).map((setting => `[1m${setting}:[0m ${Settings[setting]}`)).sort().join('\n')}\n`);
    const accReq = await fetch(AI.endPoint() + '/api/organizations', {
        'method': 'GET',
        'headers': {
            'Cookie': Cookie
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
    updateCookies(Cookie, true);
    updateCookies(accReq);
    console.log('Logged in %o', {
        'name': accInfo.name?.split('@')?.[0],
        'capabilities': accInfo.capabilities
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
                'headers': {
                    'Cookie': getCookies(),
                    'Content-Type': 'application/json'
                },
                'method': 'POST'
            });
            updateCookies(req);
            const json = await req.json();
            console.log(`${flag}: ${json.error ? json.error.message || json.error.type || json.detail : 'OK'}`);
        })(flag))));
    }
    if (Settings.RecycleChats) {
        const convReq = await fetch(`${AI.endPoint()}/api/organizations/${uuidOrg}/chat_conversations`, {
            'method': 'GET',
            'headers': {
                'Cookie': getCookies()
            }
        });
        (await convReq.json()).filter((chat => chat.name.length > 0)).forEach((chat => UUIDMap[chat.name] = chat.uuid));
        updateCookies(convReq);
    }
}));

Proxy.on('error', (err => {
    console.error('Proxy error\n%o', err);
}));