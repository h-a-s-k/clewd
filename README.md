<div align="center">
<a href="https://gitgud.io/ahsk/clewd/">
<h1>Clewd</h1>
  <img
    height="90"
    width="90"
    alt="Clewd"
    src="https://gitgud.io/ahsk/clewd/-/raw/master/logo.png"
    align="left"
  />
</a>
<a href="https://gitgud.io/ahsk/clewd/-/archive/master/clewd-master.zip">
<p>doom & coom</p>
<img align="center" src="https://gitgud.io/ahsk/clewd/-/raw/master/program.png">
</a>
</div>

---

## Requirements

nodejs>=19.8.*

## Defaults

### SettingName: (DEFAULT)/opt1/opt2

 1. AdaptClaude: (false)/true
    * tries to make human/assistant prompts uniform between endpoints
    * almost useless with streaming on, effective with streaming off
    * Human->H
    * Human<-H

 2. AntiStall: (false)/1/2
    * pretty much useless when using streaming
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

> [Download](https://gitgud.io/ahsk/clewd/-/archive/master/clewd-master.zip)