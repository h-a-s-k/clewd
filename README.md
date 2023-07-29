<div align="center">
<a href="https://gitgud.io/ahsk/clewd/">
<h1>Clewd 1.6</h1>
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

Warning: Some accounts are getting _hard-blacklisted_ by the **rats**, you might notice it

<br>
<br>
<hr>
<a href="https://gitgud.io/ahsk/clewd/-/archive/1.6/clewd-1.6.zip">
   <img src="https://gitgud.io/ahsk/clewd/-/raw/1.6/program.png">
</a>
<hr>

</div>

## Requirements

nodejs>=20.4.*

---

## Defaults

### SettingName: (DEFAULT)/opt1/opt2

 1. AdaptClaude: (false)/true
    * tries to make human/assistant prompts uniform between endpoints
    * almost useless with streaming on... for now ;)
    * effective with streaming off
    * Human->H
    * Human<-H

 2. AntiStall: (false)/1/2
    * no effect when using streaming
    * 1 sends whatever was last when exceeding size (might send empty reply)
    * 2 keeps going until it finds something usable or hitting size limit

 3. ClearFlags: (false)/true
    * possibly snake-oil

 4. RecycleChats: (false)/true
    * false is less likely to get caught in a censorship loop

 5. StripAssistant: (false)/true
    * might be good if your prompt/jailbreak itself ends with Assistant: 

 6. StripHuman: (false)/true
    * bad idea without RecycleChats, sends only your very last message

---

## FAQ
> I get empty replies

They send broken replies VERY often. If you have AntiStall set to false/1, once clewd receives ALL/hits the limit of claude's fever dream, it will send that shit to SillyTavern, IF it's broken, SillyTavern will error out and there will be no message

> I keep getting H:

This can be a character issue, a main prompt issue, a jailbreak issue or even claude itself, AdaptClaude is there to try to make shit more consistent

> What about context/temperature/top_k/top_p
None of it is sent, some experimental shit will come out soon™ though

> What about the flags

Only `consumer_restricted_mode` is the real bad one from what I've seen. If you get *the yellow warning* though, you'll know your account is *possibly* toast

---

## Downloads

> ### [Download latest version](https://gitgud.io/ahsk/clewd/)

> ### [Download 1.6](https://gitgud.io/ahsk/clewd/-/archive/1.6/clewd-1.6.zip)