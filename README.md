<div align="center">
<a href="https://gitgud.io/ahsk/clewd/">
<h1>Clewd</h1>
  <img
    height="120"
    width="120"
    alt="Clewd"
    title="Clewd"
    src="https://gitgud.io/ahsk/clewd/-/raw/master/media/logo.png"
    align="left"
  />

doom & coom
</a>
<br>

Warning: Some accounts are getting _hard-censored_ by the **rats**, you might notice it

<br>
<br>
<hr>
<a href="https://gitgud.io/ahsk/clewd/-/archive/master/clewd-master.zip">
   <img src="https://gitgud.io/ahsk/clewd/-/raw/master/media/program.png">
</a>
<h2><a href="https://gitgud.io/ahsk/clewd/-/blob/master/CHANGELOG.md">CHANGELOG</a></h2>
</div>

## Requirements

- [nodejs>=20.4.*](https://nodejs.org/en/download/current)

- [git>=2.41.*](https://gitforwindows.org/)

## Defaults

### SettingName: (DEFAULT)/opt1/opt2...

 - `Superfetch`: (true)/false
    * true will use an alternate method to get past the `We are unable to serve your request` error
    * false won't use this method and you may get the error again

 - `PreventImperson`: (true)/false
    * true trims the bot reply immediately if he says "Human:", "Assistant:", "H:" or "A:"
    * making it so it doesn't hallucinate speaking as you __(chance of missing some spicy things)__

 - `PromptExperiments`: (true)/false
    * true is an alternative way to send your prompt to the AI
    * experiment before setting to false
    * incompatible with `RenewAlways` set to false

 - `RetryRegenerate`: (false)/true
    * true uses the AI's own retry mechanism when you regenerate on your frontend
    * instead of a new conversation
    * experiment with it

 - `SystemExperiments`: (true)/false
    * only has any effect when `RenewAlways` is false
    * true alternates between Main+Jailbreak+User and Jailbreak+User
    * false doesn't alternate

 - `RenewAlways`: (true)/false
    * true makes a new conversation context each time
    * false *tries* to reutilize the same old conversation, sending only the actual last message each time, taking into consideration `SystemExperiments` (will not work properly unless your Main is the first system prompt and your Jailbreak is the last)

 - `SendImageDepth`: (3)
    - detects a image in the prompt and includes it in the next response. requires `Send inline images`.
    * 0 will not send images to the AI
    * \>=1 attaches the last image to prompt, provided it was found within the specified depth (last X messages). after that, the image is not included and the AI will become clueless about it

 - `StripAssistant`: (false)/true
    * true strips the "Assistant:" prefix from the last assistant message (if it's the last message)

 - `StripHuman`: (false)/true
    * true strips the "Human:" prefix from the last human message (if it's the last message)

 - `AllSamples`: (false)/true
    * mutually exclusive with `NoSamples`
    * true converts all real dialogues to "sample dialogues" (except the last Assistant and Human messages)
    * you're "H" and the AI is "A"
    * whatever the AI replies with is kept (only outgoing)
    * [see this](https://docs.anthropic.com/claude/docs/prompt-troubleshooting-checklist#the-prompt-is-formatted-correctly) for more information
    - Human->H
    - Assistant->A

 - `NoSamples`: (false)/true
    * mutually exclusive with `AllSamples`
    * true converts all "sample dialogues" to real dialogues
    * you're "Human" and the AI is "Assistant"
    * whatever the AI replies with is kept (only outgoing)
    * [see this](https://docs.anthropic.com/claude/docs/prompt-troubleshooting-checklist#the-prompt-is-formatted-correctly) for more information
    - H->Human
    - A->Assistant
	
 - `LogMessages`: (false)/true
    * true logs prompt and reply to `log.txt`

 - `ClearFlags`: (false)/true
    * possibly snake-oil
    * clears your warnings

 - `PassParams`: (false)/true
    * true will send the temperature you set on your frontend
    * only values under <=1.0 >= 0.1
    * this could get your account banned
    * if clewd stops working, set to false

 - `PreserveChats`: (false)/true
    * true prevents the deletion of old chats at any point



## Examples

**safe setup**
> **PreventImperson**: true

> **RenewAlways**: true

> **PromptExperiments**: true

> **PreserveChats**: true

---

**experimental setup**
> **SystemExperiments**: true

> **RetryRegenerate**: true

> **PreventImperson**: true

> **RenewAlways**: false

> **PromptExperiments**: false

> **AllSamples**: true

## Contact

- hask1911@proton.me


## Downloads

> ### [Download latest version](https://gitgud.io/ahsk/clewd/-/archive/master/clewd-master.zip)

> ### [Download 3.8.5](https://gitgud.io/ahsk/clewd/-/archive/3.8.5/clewd-3.8.5.zip)

> ### [Download 2.7](https://gitgud.io/ahsk/clewd/-/archive/2.7/clewd-2.7.zip)