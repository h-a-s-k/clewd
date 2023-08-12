/*
* https://rentry.org/teralomaniac_clewd
*/

// SET YOUR COOKIE BELOW

module.exports = {
    "Cookie": "intercom-device-id-lupk8zyo=fc72e7a7-22cb-46f5-936d-eaedac0067d2; sessionKey=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; __cf_bm=Ag9AZzW_Yx.M3xwV0OdaAhIxFACoXGZaV5Nx1Qm4MNI-1691804195-0-AXgAeboNhxapALw5kRQuhq4pNzDCRBmEOiXwswZLrOWuLnOrd+V5g8QuiC/t+kT/nCizhTB7XybFym5MZdL9as8=; intercom-session-lupk8zyo=MmhRcmtQb2tqSzhab2kyWHVISG5PcUVlM2QwUXJjbERaeTQ1WGFLYi81b05Bc0puaXVOMGYzYkRSaCsyQVNyNi0tREp2Q2RLSGl1bnE4N2RZbnhSaXVUdz09--82c82dcc7d5971af1e7ffae5a58d481587df44ce",
    "Ip": "127.0.0.1",
    "Port": 8444,
    "BufferSize": 1,
    "SystemInterval": 3,
    "LogMessages": true,
    "Settings": {
        "AllSamples": false,
        "ClearFlags": true,
        "deleteChatoff": true,
        "FullColon": true,
        "localtunnel": true,
        "NoSamples": false,
        "padtxt": true,
        "PassParams": false,
        "PreventImperson": false,
        "PromptExperiment": true,
        "RetryRegenerate": false,
        "RenewAlways": true,
        "StripAssistant": false,
        "StripHuman": false,
        "SystemExperiments": true,
        "StripFirstH": true,
        "ProxyWebsite": false,
        "xmlPlot": true
    },
    "ExampleChatPrefix": "[Start a new Chat]\n\n",
    "RealChatPrefix": "[Start a new Chat]\n\n",
    "PromptMain": "{{MAIN_AND_CHARACTER}}\n\n{{CHAT_EXAMPLE}}\n\n{{CHAT_LOG}}\n\n{{JAILBREAK}}",
    "PromptReminder": "{{MAIN_AND_CHARACTER}}\n\n{{JAILBREAK}\n\n{{LATEST_USER}}",
    "PromptContinue": "{{JAILBREAK}}\n\n{{LATEST_USER}}"
}

/*
 BufferSize
 * How many characters will be buffered before the AI types once
 * lower = less chance of `PreventImperson` working properly

 ---

 SystemInterval, PromptMain, PromptReminder, PromptContinue
 * when `RenewAlways` is set to true (default), `Main` is always the one being used

 * when `RenewAlways` is set to false, `Main` is sent on conversation start
 * then only `Continue` is sent as long as no impersonation happened
 * `Simple` and `Reminder` alternate every `SystemInterval`
 * 
 * {{MAIN_AND_CHARACTER}}, {{CHAT_EXAMPLE}}, {{CHAT_LOG}}, {{JAILBREAK}}, {{LATEST_ASSISTANT}}, {{LATEST_USER}}

 ---

 Other settings
 * https://gitgud.io/ahsk/clewd/#defaults
 * https://gitgud.io/ahsk/clewd/-/blob/master/CHANGELOG.md#anchor-30
 */