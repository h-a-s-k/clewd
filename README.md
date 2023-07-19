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
</a>

doom & coom

<br>

Warning: Some accounts are getting _hard-blacklisted_ by the **rats**, you might notice it

<br>
<br>
<hr>
<a href="https://gitgud.io/ahsk/clewd/-/archive/master/clewd-master.zip">
   <img src="https://gitgud.io/ahsk/clewd/-/raw/master/program.png">
</a>
<hr>

</div>

## Requirements

nodejs>=20.4.*

---

## Defaults

### SettingName: (DEFAULT)/opt1/opt2

 1. AdaptClaude: (true)/false
    * tries to make human/assistant prompts uniform between endpoints
    * effective both with streaming on and off now
    - Human->H
    - Human<-H
    - Assistant->A
    - Assistant<-A

 2. AntiStall: (false)/1/2
    * no effect when using streaming
    * 1 sends whatever was last when exceeding size (might have some spicy things but impersonations as well)
    * 2 sends a usable message where the bot actually stopped talking

 3. ClearFlags: (false)/true
    * possibly snake-oil

 5. PassParams: (false)/true
    * true will send the temperature you set on your frontent
    * only values under <=1
    * this could get your account banned
    * if clewd stops working, set to false

 6. PreventImperson: (true)/false
    * trims the bot reply immediately if he says "Human:" or "H:"
    * making it so it doesn't hallucinate speaking as you (chance of missing some spicy things)
    * it's probable this will trigger before AntiStall if you have that on

 7. RecycleChats: (false)/true
    * false is much less likely to get caught in a censorship loop

 8. StripAssistant: (false)/true
    * might be good if your prompt/jailbreak itself ends with Assistant: 

 9. StripHuman: (false)/true
    * bad idea without RecycleChats, sends only your very last message

---

> ### [Download latest version](https://gitgud.io/ahsk/clewd/-/archive/master/clewd-master.zip)


> ### [Download old version](https://gitgud.io/ahsk/clewd/-/archive/1.6/clewd-1.6.zip)