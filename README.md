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

 1. AntiStall: (false)/1/2
    * 1 sends whatever was last when exceeding size (might send empty reply)
    * 2 returns the second reply by the assistant (the first is usually an apology)
    * false is the same as original slaude2 (sometimes stall, sometimes empty reply)
    * (try out 2 if you're getting empty messages)

 2. ClearFlags: (false)
    * possibly snake-oil

 3. RecycleChats: (false)
    * false is less likely to get caught in a censorship loop

 4. StripAssistant: (false)
    * might be good if your prompt/jailbreak itself ends with Assistant: 

 5. StripHuman: (false) 
    * might(?) combo well with RecycleChats, avoids sending the whole prompt history to each message

> [Download](https://gitgud.io/ahsk/clewd/-/archive/master/clewd-master.zip)