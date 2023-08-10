<div align="center">
<a href="https://gitgud.io/ahsk/clewd/">
<h1>Clewd</h1>
  <img
    height="120"
    width="120"
    alt="Clewd"
    title="Clewd"
    src="https://gitgud.io/ahsk/clewd/-/raw/master/logo.png"
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
   <img src="https://gitgud.io/ahsk/clewd/-/raw/master/program.png">
</a>
<h2><a href="https://gitgud.io/ahsk/clewd/-/blob/master/CHANGELOG.md">CHANGELOG</a></h2>
</div>

## Requirements

nodejs>=20.4.*

## Defaults

### SettingName: (DEFAULT)/opt1/opt2

 1. AntiStall: (2)/1/false
    * 1/2 has no effect when using streaming
    * 1 sends whatever was last when exceeding size (might have some spicy things but impersonations as well)
    * 2 sends a usable message where the bot actually stopped talking

 2. ClearFlags: (false)/true
    * possibly snake-oil

 3. DeleteChats: (false)/true
    * true is for privacy, auto deletes your conversations after each reply
    * **if set to true, will also wipe old conversations on startup!**
    * no effect if RetryRegenerate is set to true

 4. PassParams: (false)/true
    * true will send the temperature you set on your frontent
    * only values under <=1
    * this could get your account banned
    * if clewd stops working, set to false

 5. PreventImperson: (false)/true
    * true trims the bot reply immediately if he says "Human:", "Assistant:", "H:" or "A:"
    * making it so it doesn't hallucinate speaking as you __(chance of missing some spicy things)__
    * it's probable this will trigger before AntiStall if you have that on

 6. PromptExperiment: (true)/false
    * true is an alternative way to send your prompt to the AI
    * experiment before setting to false

 7. RecycleChats: (false)/true
    * true reuses the same chat on the website, based on the first prompt
    * false is less likely to get caught in a censorship loop

 8. ReplaceSamples: (false)/true
    * true sends no "sample dialogues" to the AI (no "H" or "A")
    * instead, you're always "Human" and the AI is always "Assistant"
    * whatever the AI replies with is kept (only outgoing)
    * [see this](https://docs.anthropic.com/claude/docs/prompt-troubleshooting-checklist#the-prompt-is-formatted-correctly) for more information
    - H->Human
    - A->Assistant

 9. RetryRegenerate: (false)/true
    * true uses the AI's own retry mechanism when you regenerate on your frontend
    * instead of a new conversation
    * experiment with it

 10. StripAssistant: (false)/true
    * true might be good IF your prompt/jailbreak itself ends with Assistant: 

 11. StripHuman: (false)/true
    * true is a bad idea without RecycleChats, sends only your very last message


## Examples

decent **without** streaming

> **ReplaceSamples**: false

> **AntiStall**: 2 and/or **PreventImperson**: true
---
decent **with** streaming
> **ReplaceSamples**: false

> **PreventImperson**: false (higher chance of spicy results)

> **PromptExperiment**: true

## Downloads

> ### [Download latest version](https://gitgud.io/ahsk/clewd/-/archive/master/clewd-master.zip)

> ### [Download 2.7](https://gitgud.io/ahsk/clewd/-/archive/2.7/clewd-2.7.zip)

> ### [Download 1.6](https://gitgud.io/ahsk/clewd/-/archive/1.6/clewd-1.6.zip)