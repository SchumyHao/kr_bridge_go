# KRGO
bridge to smart home platform to jimus graphical automation editor.

# Installation

## Docker

- pull image with `docker pull jimus/krgo`

# Prepare

- Create a folder named config.
- Create a folder named config/.config.
- Create a file named config/.config/hass.json.
- Edit hass.json. Set your hass IP and PORT
  ```json
  {
    "ip": "127.0.0.1",
    "port": "8123"
  }
  ```

# Run

## Docker

- Start docker with 
  ```
  docker run --net=host -v {ABS_PATH_TO_YOUT_CONFIG_FOLDER}/config:/config --name mynodered krgo:latest
  ```
  
----------------------------------
# KRGO
jimus智能家居平台图形化编辑自动化工具.

# 安装

## Docker

- 拉取镜像 `docker pull jimus/krgo`

# 准备工作

- 新建名字为config的文件夹.
- 新建名字为config/.config的文件夹.
- 新建名字为config/.config/hass.json的文件.
- 编辑hass.json. 设置IP和PORT
  ```json
  {
    "ip": "127.0.0.1",
    "port": "8123"
  }
  ```

# 执行

## Docker

- 在命令行中执行 
  ```
  docker run --net=host -v {ABS_PATH_TO_YOUT_CONFIG_FOLDER}/config:/config --name mynodered krgo:latest
  ```
