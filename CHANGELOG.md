<div align="center">
<h1>Changelog</h1>
<a href="https://gitgud.io/ahsk/clewd/">
  <img
    height="120"
    width="120"
    alt="Clewd"
    title="Clewd"
    src="https://gitgud.io/ahsk/clewd/-/raw/master/logo.png"
    align="center"
  />
</a>
</div>

---

### 2.7
> Fixed broken newlines

---

### 2.6
> **AdaptClaude** removed

> **ReplaceSamples** added (defaults false)

If set to true, will replace any cases of **outgoing** H/A, to Human/Assistant

now has **no effect** on incoming, [more info](https://docs.anthropic.com/claude/docs/prompt-troubleshooting-checklist#the-prompt-is-formatted-correctly)

>**PreventImperson** updated

now also stops on A: or Assistant:
another check added, *should* impersonate less often

---

### 2.5
> Changed some defaults around

refer to the [README](https://gitgud.io/ahsk/clewd/#defaults) for the reasoning behind each

> **DeleteChats** bugfix

---

### 2.4
> **DeleteChats** added (defaults false)

for privacy, deletes old chats on startup and deletes any new ones after receiving a reply

> **PreventImperson** bugfix

should be more accurate now

> **RetryRegenerate** no longer defaults true

---

### 2.0 to 2.2
> **RetryRegenerate** added (defaults true)

uses the AI's own retry mechanism when you regenerate on your frontend, if you change anything from your last prompt before regenerating it will default to old behavior

> **PromptExperiment** added (defaults true)

an alternative way to send your prompt to the AI, through a file. set to false if it's bad
both enabled: https://files.catbox.moe/io1q53.webm

---

### 1.6 to 2.0
> **AdaptClaude** now should work better with streaming on

> **AntiStall 2**

now returns up to the first AI reply instead of the second, **AntiStall 1** sends the whole schizophrenia (good chance of some spicy things being included)

> **PreventImperson**

added, stops the bot immediately once it starts pretending to be you (you can use this as kind of a AntiStall, chance of missing some spicy things)

> **PassParams** added (defaults false)

now whatever temperature <=1 you set on SillyTavern will be forwarded to claude (if you get errors turn this shit off), also, no idea if this does anything but they accept it

---

> [README](https://gitgud.io/ahsk/clewd/#defaults)