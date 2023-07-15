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
    * pretty much useless when using streaming
    * 1 sends whatever was last when exceeding size (might send empty reply)
    * 2 returns the second reply by the assistant (the first is usually an apology)

 2. ClearFlags: (false)
    * possibly snake-oil

 3. RecycleChats: (false)
    * false is less likely to get caught in a censorship loop

 4. StripAssistant: (false)
    * might be good if your prompt/jailbreak itself ends with Assistant: 

 5. StripHuman: (false) 
    * bad idea without RecycleChats, sends only your very last message

> [Download](https://gitgud.io/ahsk/clewd/-/archive/master/clewd-master.zip)