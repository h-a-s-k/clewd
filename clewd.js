/*
* https://gitgud.io/ahsk/clewd
* https://github.com/h-a-s-k/clewd
*/
'use strict';

const {createServer: Server, IncomingMessage, ServerResponse} = require('node:http'), {createHash: Hash, randomUUID, randomInt, randomBytes} = require('node:crypto'), {TransformStream, ReadableStream} = require('node:stream/web'), {Readable, Writable} = require('node:stream'), {pipeline: pipelineP} = require('node:stream/promises'), {Blob} = require('node:buffer'), {existsSync: exists, writeFileSync: write, createWriteStream, writeFileSync} = require('node:fs'), {join: joinP} = require('node:path'), {ClewdSuperfetch: Superfetch, SuperfetchAvailable, SuperfetchFoldersMk, SuperfetchFoldersRm} = require('./lib/clewd-superfetch'), {AI, fileName, genericFixes, bytesToSize, setTitle, checkResErr, Main, isBase64String, rgxBase64} = require('./lib/clewd-utils'), {isSTDivider, messagesToPrompt} = require('./lib/clewd-message'), ClewdStream = require('./lib/clewd-stream');

let ChangedSettings, UnknownSettings, Logger;

const ConfigPath = joinP(__dirname, './config.js'), LogPath = joinP(__dirname, './log.txt'), Conversation = {
    char: null,
    uuid: null,
    depth: 0
}, cookies = {};

let uuidOrg, curPrompt = {}, prevPrompt = {}, prevMessages = [], prevImpersonated = false, assignedModel = null, Config = {
    Cookie: '',
    Ip: '127.0.0.1',
    Port: 8444,
    BufferSize: 8,
    SystemInterval: 3,
    PromptExperimentFirst: '',
    PromptExperimentNext: '',
    PersonalityFormat: '{{char}}\'s personality: {{personality}}',
    ScenarioFormat: 'Dialogue scenario and context: {{scenario}}',
    Settings: {
        RenewAlways: true,
        RetryRegenerate: false,
        PromptExperiments: true,
        SystemExperiments: true,
        PreventImperson: true,
        AllSamples: false,
        NoSamples: false,
        StripAssistant: false,
        StripHuman: false,
        PassParams: false,
        ClearFlags: false,
        PreserveChats: false,
        LogMessages: false,
        Superfetch: true,
        SendImageDepth: 3
    }
};

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

const updateParams = res => {
    updateCookies(res);
}, updateCookies = res => {
    if (!res) {
        return;
    }
    let cookieNew = '';
    res instanceof Response ? cookieNew = res.headers?.get('set-cookie') : res.superfetch ? cookieNew = res.headers?.['set-cookie'] : 'string' == typeof res && (cookieNew = res.split('\n').join(''));
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
    const res = await (Config.Settings.Superfetch ? Superfetch : fetch)(`${AI.end}/api/organizations/${uuidOrg}/chat_conversations/${uuid}`, {
        headers: {
            ...AI.hdr(),
            Cookie: getCookies()
        },
        method: 'DELETE'
    });
    updateParams(res);
    return res.status;
}, onListen = async () => {
    if ('SET YOUR COOKIE HERE' === Config.Cookie || Config.Cookie?.length < 1) {
        throw Error('Set your cookie inside config.js');
    }
    updateCookies(Config.Cookie);
    console.log(`[2m${Main}[0m\n[33mhttp://${Config.Ip}:${Config.Port}/v1[0m\n\n${Object.keys(Config.Settings).map((setting => UnknownSettings.includes(setting) ? `??? [31m${setting}: ${Config.Settings[setting]}[0m` : `[1m${setting}:[0m ${ChangedSettings.includes(setting) ? '[33m' : '[36m'}${Config.Settings[setting]}[0m`)).sort().join('\n')}\n`);
    if (Config.Settings.Superfetch) {
        SuperfetchAvailable(true);
        SuperfetchFoldersMk();
    }
    const accInfo = await (async () => {
        const headers = {
            ...AI.hdr(),
            Cookie: getCookies(),
            'anthropic-client-sha': 'unknown',
            'anthropic-client-version': 'unknown'
        }, accInfoRes = await (Config.Settings.Superfetch ? Superfetch : fetch)(AI.end + '/api/bootstrap', {
            method: 'GET',
            headers
        });
        await checkResErr(accInfoRes);
        const accInfoJson = await accInfoRes.json(), accOrgs = accInfoJson?.account?.memberships?.filter((org => org.organization)) || [], name = accInfoJson?.account?.email_address?.split('@')?.[0] || '??', capabilities = accOrgs[0]?.organization?.capabilities;
        uuidOrg = accOrgs[0]?.organization?.uuid;
        if (!uuidOrg) {
            throw Error(`Couldn't find id: "${accInfoJson?.error?.message || accInfoRes.statusText || accInfoRes.status}"`);
        }
        if (accOrgs.length < 1) {
            throw Error(`Couldn't find org: "${accInfoJson?.error?.message || accInfoRes.statusText || accInfoRes.status}"`);
        }
        updateParams(accInfoRes);
        const accStatsig = await (Config.Settings.Superfetch ? Superfetch : fetch)(`${AI.end}/api/account/statsig/${uuidOrg}`, {
            method: 'GET',
            headers: {
                ...AI.hdr(),
                Cookie: getCookies(),
                'anthropic-client-sha': 'unknown',
                'anthropic-client-version': 'unknown'
            }
        });
        await checkResErr(accStatsig);
        const accStatsigJson = await accStatsig.json(), type = true === accStatsigJson?.user?.custom?.isPro ? 'pro' : 'free', modelsAll = (accStatsigJson?.values?.dynamic_configs?.['R0FVshL4aI3OcWe2hMvT/3S2I89bAW5B9n0moWX66sA=']?.value?.models || []).map((entry => entry.model));
        AI.mdl = [ ...new Set([ ...AI.mdl, ...modelsAll ]) ];
        const modelsInfo = Object.entries(accStatsigJson?.values?.dynamic_configs?.['TZDmWcVIjsdmEcb9XJSbVmhsuJAJiM4wKj0hxOMBraQ=']?.value || {}).map((([name, properties]) => {
            if (!properties[type]?.maxContextSize) {
                properties[type].maxContextSize = properties[type].hardLimit;
                delete properties[type].hardLimit;
            }
            return {
                name,
                ...properties[type]
            };
        })), assignedModelName = accStatsigJson?.values?.dynamic_configs?.['6zA9wvTedwkzjLxWy9PVe7yydI00XDQ6L5Fejjq/2o8=']?.value?.model || '???', modelLimits = accStatsigJson?.values?.dynamic_configs?.['TZDmWcVIjsdmEcb9XJSbVmhsuJAJiM4wKj0hxOMBraQ=']?.value?.[assignedModelName]?.[type] || accStatsigJson?.values?.dynamic_configs?.['TZDmWcVIjsdmEcb9XJSbVmhsuJAJiM4wKj0hxOMBraQ=']?.value?.default?.[type] || {
            output: '???',
            maxContextSize: '???'
        };
        assignedModel = modelsInfo.find((model => model.name === assignedModelName)) || {
            name: assignedModelName,
            ...modelLimits
        };
        if (!accStatsig || accStatsigJson.error) {
            throw Error(`Couldn't get account info: "${accStatsigJson?.error?.message || accStatsig.statusText}"`);
        }
        updateParams(accStatsig);
        return {
            name,
            type,
            capabilities,
            organizations: accOrgs.length
        };
    })(), accFlags = await (async () => {
        const accOrgRes = await (Config.Settings.Superfetch ? Superfetch : fetch)(AI.end + '/api/organizations', {
            method: 'GET',
            headers: {
                ...AI.hdr(),
                Cookie: getCookies(),
                'anthropic-client-sha': 'unknown',
                'anthropic-client-version': 'unknown'
            }
        }), accOrgInfo = (await accOrgRes.json())?.[0];
        if (!accOrgInfo || accOrgInfo?.error) {
            throw Error(`Failed to fetch org info: "${accOrgInfo?.error?.message || accOrgRes.statusText}"`);
        }
        if (!accOrgInfo?.uuid) {
            throw Error('Failed to fetch org info: Invalid id');
        }
        let formattedFlags;
        if (accOrgInfo?.active_flags?.length > 0) {
            const now = new Date;
            formattedFlags = accOrgInfo.active_flags.map((flag => {
                const days = ((new Date(flag.expires_at).getTime() - now.getTime()) / 864e5).toFixed(2);
                return {
                    type: flag.type,
                    remaining_days: days
                };
            }));
            console.warn('[31mYour account has warnings[0m %o', formattedFlags);
        }
        return formattedFlags || accOrgInfo?.active_flags || [];
    })();
    setTitle('ok');
    console.log('Logged in %o', {
        name: accInfo.name,
        type: accInfo.type,
        capabilities: accInfo.capabilities,
        assigned_model: assignedModel
    });
    await Promise.all(accFlags.map((flag => (async type => {
        if (!Config.Settings.ClearFlags) {
            return;
        }
        if ('consumer_restricted_mode' === type) {
            return;
        }
        const req = await (Config.Settings.Superfetch ? Superfetch : fetch)(`${AI.end}/api/organizations/${uuidOrg}/flags/${type}/dismiss`, {
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
    await (async () => {
        if (Config.Settings.PreserveChats) {
            return;
        }
        const convRes = await (Config.Settings.Superfetch ? Superfetch : fetch)(`${AI.end}/api/organizations/${uuidOrg}/chat_conversations`, {
            method: 'GET',
            headers: {
                ...AI.hdr(),
                Cookie: getCookies(),
                'anthropic-client-sha': 'unknown',
                'anthropic-client-version': 'unknown'
            }
        }), conversations = await convRes.json();
        updateParams(convRes);
        if (conversations.length > 0) {
            console.warn(`[33mwiping[0m [1m${conversations.length}[0m [33mold chats[0m`);
            const results = await Promise.all(conversations.map((conv => deleteChat(conv.uuid))));
            console.log(`${200 == results[0] ? '[32m' : '[33m'}${results[0]}![0m\n`);
        }
    })();
}, writeSettings = async (config, firstRun = false) => {
    write(ConfigPath, `/*\n* https://gitgud.io/ahsk/clewd\n* https://github.com/h-a-s-k/clewd\n*/\n\n// SET YOUR COOKIE BELOW\n\nmodule.exports = ${JSON.stringify(config, null, 4)}\n\n/*\n BufferSize\n * How many characters will be buffered before the AI types once\n * lower = less chance of \`PreventImperson\` working properly\n\n ---\n\n SystemInterval\n * How many messages until \`SystemExperiments alternates\`\n\n ---\n\n Other settings\n * https://gitgud.io/ahsk/clewd/#defaults\n * and\n * https://gitgud.io/ahsk/clewd/-/blob/master/CHANGELOG.md\n */`.trim().replace(/((?<!\r)\n|\r(?!\n))/g, '\r\n'));
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
            data: AI.mdl.map((name => ({
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
            const abortControl = new AbortController, {signal} = abortControl;
            res.socket.on('close', (async () => {
                abortControl.signal.aborted || abortControl.abort();
            }));
            const buffer = [];
            req.on('data', (chunk => {
                buffer.push(chunk);
            }));
            req.on('end', (async () => {
                let clewdStream, titleTimer, samePrompt = false, shouldRenew = true, retryRegen = false, imageId = '';
                try {
                    const body = JSON.parse(Buffer.concat(buffer).toString());
                    let {messages, stream: streaming, model: modelName, temperature} = body;
                    temperature = Math.max(.1, Math.min(1, temperature));
                    if (!messages || messages.length < 1) {
                        throw Error('Select OpenAI as completion source');
                    }
                    if (!streaming && 1 === messages.length && JSON.stringify(messages.sort() || []) === JSON.stringify([ {
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
                    streaming && res.setHeader('Content-Type', 'text/event-stream');
                    if (!streaming && messages?.[0]?.content?.startsWith('From the list below, choose a word that best represents a character\'s outfit description, action, or emotion in their dialogue')) {
                        return res.json({
                            choices: [ {
                                message: {
                                    content: 'neutral'
                                }
                            } ]
                        });
                    }
                    if (Config.Settings.AllSamples && Config.Settings.NoSamples) {
                        console.log('[33mhaving both[0m [1mAllSamples[0m [33mand[0m [1mNoSamples[0m [33m set to true is not supported[0m');
                        throw Error('Only one can be used at the same time: AllSamples/NoSamples');
                    }
                    !Config.Settings.RenewAlways && Config.Settings.PromptExperiments && console.log('[33mhaving both[0m [1mRenewAlways[0m: false [33mand[0m [1mPromptExperiments[0m: true [33mwill likely error out after a few messages. set[0m [1mRenewAlways[0m: true [33mor[0m [1mPromptExperiments[0m: false');
                    if (!/^(claude-.*)|(.*goldengate.*?)/i.test(modelName)) {
                        throw Error(`Invalid model selected: ${modelName}. Supported ${AI.mdl.join(', ')}`);
                    }
                    curPrompt = {
                        firstUser: messages.find((message => 'user' === message.role)),
                        firstSystem: messages.find((message => 'system' === message.role)),
                        firstAssistant: messages.find((message => 'assistant' === message.role)),
                        lastUser: messages.findLast((message => 'user' === message.role)),
                        lastSystem: messages.findLast((message => 'system' === message.role && !isSTDivider(message))),
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
                    const sameCharDiffChat = !samePrompt && curPrompt.firstSystem?.content === prevPrompt.firstSystem?.content && curPrompt.firstUser?.content !== prevPrompt.firstUser?.content;
                    shouldRenew = Config.Settings.RenewAlways || !Conversation.uuid || prevImpersonated || !Config.Settings.RenewAlways && samePrompt || sameCharDiffChat;
                    retryRegen = Config.Settings.RetryRegenerate && samePrompt && null != Conversation.uuid;
                    samePrompt || (prevMessages = JSON.parse(JSON.stringify(messages)));
                    let promptType = '';
                    if (retryRegen) {
                        promptType = 'R';
                        fetchAPI = await (async signal => {
                            assignedModel.name;
                            const body = {
                                prompt: '',
                                parent_message_uuid: '',
                                timezone: AI.zone(),
                                attachments: [],
                                files: [],
                                rendering_mode: 'raw'
                            };
                            let headers = {
                                ...AI.hdr(Conversation.uuid || ''),
                                Accept: 'text/event-stream',
                                Cookie: getCookies()
                            };
                            const res = await (Config.Settings.Superfetch ? Superfetch : fetch)(`${AI.end}/api/organizations/${uuidOrg || ''}/chat_conversations/${Conversation.uuid || ''}/retry_completion`, {
                                stream: true,
                                signal,
                                method: 'POST',
                                body: JSON.stringify(body),
                                headers
                            });
                            updateParams(res);
                            await checkResErr(res);
                            return res;
                        })(signal);
                    } else if (shouldRenew) {
                        Conversation.uuid && await deleteChat(Conversation.uuid);
                        fetchAPI = await (async signal => {
                            Conversation.uuid = randomUUID().toString();
                            Conversation.depth = 0;
                            const res = await (Config.Settings.Superfetch ? Superfetch : fetch)(`${AI.end}/api/organizations/${uuidOrg}/chat_conversations`, {
                                signal,
                                headers: {
                                    ...AI.hdr(),
                                    Cookie: getCookies(),
                                    'anthropic-client-sha': 'unknown',
                                    'anthropic-client-version': 'unknown'
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
                        promptType = 'r';
                    } else if (samePrompt) {} else {
                        const systemExperiment = !Config.Settings.RenewAlways && Config.Settings.SystemExperiments;
                        if (!systemExperiment || systemExperiment && Conversation.depth >= Config.SystemInterval) {
                            promptType = 'c-r';
                            Conversation.depth = 0;
                        } else {
                            promptType = 'c-c';
                            Conversation.depth++;
                        }
                    }
                    let {prompt, systems, image} = messagesToPrompt({
                        messages,
                        promptType,
                        model: modelName,
                        Config
                    });
                    image && (imageId = await (async (signal, image) => {
                        if (!isBase64String(image)) {
                            throw Error('Invalid image: ' + image.substring(0, 30));
                        }
                        const retrieve = await fetch(image), blob = await retrieve.blob(), body = new FormData;
                        body.append('file', blob);
                        let headers = {
                            ...AI.hdr(Conversation.uuid || ''),
                            Accept: '*/*',
                            Cookie: getCookies()
                        };
                        delete headers['Content-Type'];
                        delete headers.Referer;
                        const res = await (Config.Settings.Superfetch ? Superfetch : fetch)(`${AI.end}/api/${uuidOrg || ''}/upload`, {
                            stream: false,
                            signal,
                            method: 'POST',
                            body,
                            headers
                        });
                        updateParams(res);
                        const {file_uuid} = await res.json();
                        return file_uuid;
                    })(signal, image));
                    console.log(`${modelName === assignedModel.name ? '[2m' : '[33m'}${modelName}[0m [[2m${promptType}[0m]${imageId ? ' [[2mimg[0m]' : ''}${!retryRegen && systems.length > 0 ? ' ' + systems.join(' [33m/[0m ') : ''}`);
                    'R' !== promptType || prompt || (prompt = '...regen...');
                    Logger?.write(`\n\n-------\n[${(new Date).toLocaleString()}]\n####### MODEL: ${modelName}\n####### PROMPT (${promptType}):\n${prompt}\n--\n####### REPLY:\n`);
                    retryRegen || (fetchAPI = await (async (signal, modelName, prompt, temperature, type, imageId) => {
                        const isAssignedModel = assignedModel.name === modelName, attachments = [], files = [];
                        imageId && files.push(imageId);
                        if (Config.Settings.PromptExperiments) {
                            attachments.push({
                                extracted_content: prompt,
                                file_name: fileName(),
                                file_type: 'text/plain',
                                file_size: Buffer.from(prompt).byteLength
                            });
                            prompt = 'r' === type ? Config.PromptExperimentFirst : Config.PromptExperimentNext;
                        }
                        const body = {
                            attachments,
                            files,
                            sync_sources: [],
                            ...!isAssignedModel && {
                                model: modelName
                            },
                            ...Config.Settings.PassParams && {
                                temperature
                            },
                            ...Config.Settings.RenewAlways && {
                                parent_message_uuid: '00000000-0000-4000-8000-000000000000'
                            },
                            prompt: prompt || '',
                            rendering_mode: 'raw',
                            timezone: AI.zone()
                        };
                        let headers = {
                            ...AI.hdr(Conversation.uuid || ''),
                            Accept: 'text/event-stream',
                            Cookie: getCookies()
                        };
                        const res = await (Config.Settings.Superfetch ? Superfetch : fetch)(`${AI.end}/api/organizations/${uuidOrg || ''}/chat_conversations/${Conversation.uuid || ''}/completion`, {
                            stream: true,
                            signal,
                            method: 'POST',
                            body: JSON.stringify(body),
                            headers
                        });
                        updateParams(res);
                        await checkResErr(res);
                        return res;
                    })(signal, modelName, prompt, temperature, promptType, imageId));
                    clewdStream = new ClewdStream({
                        config: Config,
                        minSize: Config.BufferSize,
                        streaming,
                        source: fetchAPI,
                        model: modelName,
                        abortControl
                    }, Logger);
                    titleTimer = setInterval((() => setTitle('recv ' + bytesToSize(clewdStream.size))), 300);
                    const response = Writable.toWeb(res);
                    Config.Settings.Superfetch ? await Readable.toWeb(fetchAPI.body).pipeThrough(clewdStream).pipeTo(response) : await fetchAPI.body.pipeThrough(clewdStream).pipeTo(response);
                    console.log(`${200 == fetchAPI.status ? '[32m' : '[33m'}${fetchAPI.status}![0m`);
                } catch (err) {
                    console.log(`[31m${err.status || err.code || fetchAPI.status}![0m`);
                    if ('AbortError' === err.name) {
                        res.end();
                    } else {
                        err.planned || console.error('[33mClewd:[0m\n%o', err);
                        res.json({
                            error: {
                                message: 'clewd: ' + (err.message || err.type || err.name),
                                type: err.type || err.name || err.code,
                                param: null,
                                code: err.status || err.code || 500
                            }
                        }, err.status || err.code || 500);
                    }
                } finally {
                    clearInterval(titleTimer);
                    if (clewdStream) {
                        clewdStream.censored && console.warn('[33mlikely your account is hard-censored[0m');
                        prevImpersonated = clewdStream.impersonated;
                        clewdStream.empty();
                    }
                    setTitle('ok ' + bytesToSize(clewdStream?.size || 0));
                    console.log(clewdStream?.remaining <= 10 ? `(remaining [1m${clewdStream.remaining}[0m)\n` : '\n');
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
                message: 'clewd: Set "Chat Completion source" to OpenAI instead of Claude. Enable "External" models aswell',
                code: 404
            }
        }, 404);
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
        if (exists(ConfigPath)) {
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
            userConfig.Settings.LogMessages && (Logger = createWriteStream(LogPath));
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
        SuperfetchFoldersRm();
        Logger?.close();
    } catch (err) {}
    process.exit();
};

process.on('SIGHUP', cleanup);

process.on('SIGTERM', cleanup);

process.on('SIGINT', cleanup);

process.on('exit', (async () => {
    console.log('exiting...');
}));