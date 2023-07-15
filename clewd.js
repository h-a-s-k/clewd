/**
 * SET YOUR COOKIE HERE
 * @preserve
 */
const Cookie = '';


/**
## EXPERIMENTAL

### SettingName: (DEFAULT)/opt1/opt2

 1. AdaptClaude: (false)/true
    * tries to make human/assistant prompts uniform between endpoints
    * almost useless with streaming on, effective with streaming off
    * Human->H
    * Human<-H

 2. AntiStall: (false)/1/2
    * pretty much useless when using streaming
    * 1 sends whatever was last when exceeding size (might send empty reply)
    * 2 keeps going until it finds something usable or hitting a limit of size

 3. ClearFlags: (false)/true
    * possibly snake-oil

 4. RecycleChats: (false)/true
    * false is less likely to get caught in a censorship loop

 5. StripAssistant: (false)/true
    * might be good if your prompt/jailbreak itself ends with Assistant: 

 6. StripHuman: (false)/true
    * bad idea without RecycleChats, sends only your very last message
 * @preserve
 */ const Settings = {
    'AdaptClaude': false,
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
 * If you know what you're doing, change the 1.5 MB on StallTrigger to what you want
 * @preserve
 */ const StallTriggerMax = 5242880;

const StallTrigger = 1572864;

const {'createServer': Server} = require('node:http');
const {'createHash': Hash} = require('node:crypto');
const {'v4': genUUID} = require('uuid');
const Decoder = new TextDecoder;
const Encoder = new TextEncoder;
const Assistant = '\n\nAssistant: ';
const Human = '\n\nHuman: ';
const A = '\n\nA: ';
const H = '\n\nH: ';

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
    const b = [ 'B', 'KB', 'MB', 'GB', 'TB' ];
    if (0 === bytes) {
        return '0 B';
    }
    const c = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), 4);
    return 0 === c ? `${bytes} ${b[c]}` : `${(bytes / 1024 ** c).toFixed(1)} ${b[c]}`;
};

const stallProtected = () => [ '1', '2' ].includes(Settings.AntiStall + '');

const adaptClaude = (text, direction = 'outgoing') => {
    if (!Settings.AdaptClaude) {
        return text;
    }
    const replacers = {
        'outgoing': {
            'H': [ /\n{2}Human:[ ]{1}/gm, H ],
            'A': [ /\n{2}Assistant:[ ]{1}/gm, A ]
        },
        'incoming': {
            'H': [ /\n{2}H:[ ]{1}/gm, Human ],
            'A': [ /\n{2}A:[ ]{1}/gm, Assistant ]
        }
    };
    return replacers[direction].H[0].test(text) || replacers[direction].A[0].test(text) ? text.replace(replacers[direction].H[0], replacers[direction].H[1]).replace(replacers[direction].A[0], replacers[direction].A[1]) : text;
};

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
    const controller = new AbortController;
    const {'signal': signal} = controller;
    res.socket.on('close', (async () => {
        controller.signal.aborted || controller.abort();
    }));
    const buffer = [];
    req.on('data', (chunk => {
        buffer.push(chunk);
    }));
    req.on('end', (async () => {
        try {
            const body = JSON.parse(Buffer.concat(buffer).toString());
            let {'prompt': prompt} = body;
            if (!body.stream && prompt === `${Human}${Human}Hi${Assistant}`) {
                return res.writeHead(200, {
                    'Content-Type': 'application/json'
                }).end(JSON.stringify({
                    'error': false
                }));
            }
            const model = /claude-v?2.*/.test(body.model) ? AI.modelA() : body.model;
            !Settings.RecycleChats && Settings.StripHuman && console.log('[33mhaving [1mStripHuman[0m without [1mRecycleChats[0m, not recommended[0m');
            model !== AI.modelA() && console.log(`[33mmodel[0m [1m${AI.modelA()}[0m [33mrecommended[0m`);
            stallProtected() && body.stream && (Settings.AntiStall = false);
            stallProtected() || body.stream || console.log('[33mhaving[0m [1mAntiStall[0m [33m at 1 or 2 is good when not streaming[0m')
            /**
             * Ideally SillyTavern would expose a unique frontend conversation_uuid prop to localhost proxies
             * could set the name to a hash of it
             * then fetch /chat_conversations with 'GET' and find it
             * @preserve
             */;
            const firstAssistantIdx = prompt.indexOf(Assistant);
            const hash = Hash('sha1');
            hash.update(prompt.substring(0, firstAssistantIdx));
            const sha = Settings.RecycleChats ? hash.digest('hex') : '';
            const uuidOld = UUIDMap[sha];
            const lastHumanIdx = prompt.lastIndexOf(Human);
            Settings.RecycleChats && Settings.StripHuman && uuidOld && lastHumanIdx > -1 && (prompt = prompt.substring(lastHumanIdx, prompt.length));
            const lastAssistantIdx = prompt.lastIndexOf(Assistant);
            Settings.StripAssistant && lastAssistantIdx > -1 && (prompt = prompt.substring(0, lastAssistantIdx));
            prompt = adaptClaude(prompt, 'outgoing');
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
            recvReader = fetchAPI.body.getReader({
                'type': 'bytes'
            });
            let titleTimer = setInterval((() => setTitle(`recv ${body.stream ? '(s)' : ''} ${bytesToSize(recvLength)}`)), 1e3);
            do {
                let {'done': done, 'value': chunk} = await recvReader.read();
                recvLength += chunk?.length || 0;
                if (validChunk) {
                    break;
                }
                if (null != chunk) {
                    if (body.stream) {
                        Settings.AdaptClaude && (chunk = Encoder.encode(adaptClaude(Decoder.decode(chunk), 'incoming')));
                        res.write(chunk);
                    }
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
                            console.log(`[31mstall ${triggerEmergency ? 'max' : '1'}[0m`);
                            controller.abort('stall 1');
                            break;
                        }
                        const chunkFixed = Decoder.decode(chunk).replace(/^data: {/gi, '{').replace(/\s+$/, '');
                        const chunkParsed = JSON.parse(chunkFixed);
                        let secondCompletionAssistantIdx = chunkParsed.completion.indexOf(Assistant, chunkParsed.completion.indexOf(Assistant) + 1);
                        let identifyA = Assistant;
                        if (secondCompletionAssistantIdx < 0) {
                            identifyA = A;
                            secondCompletionAssistantIdx = chunkParsed.completion.indexOf(A, chunkParsed.completion.indexOf(A) + 1);
                        }
                        if (secondCompletionAssistantIdx < 0) {
                            throw Error('Invalid completion');
                        }
                        chunkParsed.completion = chunkParsed.completion.substring(secondCompletionAssistantIdx + identifyA.length, chunkParsed.completion.length);
                        let completionHumanIdx = chunkParsed.completion.indexOf(Human);
                        completionHumanIdx < 0 && (completionHumanIdx = chunkParsed.completion.indexOf(H));
                        if (completionHumanIdx < 0) {
                            throw Error('Invalid completion');
                        }
                        chunkParsed.completion = chunkParsed.completion.substring(0, completionHumanIdx);
                        chunkParsed.stop || (chunkParsed.stop = Human.endsWith(' ') ? Human.slice(0, -1) : Human);
                        validChunk = Encoder.encode(`data: ${JSON.stringify(chunkParsed)}\n\n`);
                        controller.abort('stall 2');
                        console.log('[31mstall 2[0m');
                        break;
                    } catch (err) {}
                }
            } while (!controller.signal.aborted);
            clearInterval(titleTimer);
            setTitle(`recv ${body.stream ? '(s)' : ''} ${bytesToSize(recvLength)}`);
            Buffer.concat(recvBuffer);
            const lastChunk = recvBuffer.slice(-1)?.[0];
            const chosenChunk = validChunk || lastChunk;
            setTitle(`${fetchAPI.status}! ${bytesToSize(recvLength)}`);
            console.log(`${200 == fetchAPI.status ? '[32m' : '[33m'}${fetchAPI.status}![0m ${Math.round((chosenChunk?.length || 1) / recvLength * 100)}%\n`);
            if (200 !== fetchAPI.status) {
                res.writeHead(fetchAPI.status);
                return body.stream ? res.write(Buffer.concat(recvBuffer)).end() : res.end(Decoder.decode(Buffer.concat(recvBuffer)));
            }
            if (body.stream) {
                return res.end();
            }
            const decodedChunk = Decoder.decode(chosenChunk);
            let chunkPlain = adaptClaude(decodedChunk.replace(/^data: {/gi, '{').replace(/\s+$/, ''), 'incoming');
            res.writeHead(200, {
                'Content-Type': 'application/json'
            }).end(chunkPlain);
        } catch (err) {
            if ('AbortError' === err.name) {
                try {
                    await recvReader.cancel('');
                } catch (err) {}
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
    console.log(`[33mhttp://${Ip}:${Port}/v1[0m\n\n${Object.keys(Settings).map((setting => `[1m${setting}:[0m [36m${Settings[setting]}[0m`)).sort().join('\n')}\n`);
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