FROM ubuntu:24.04

ENV DISPLAY=:99
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    software-properties-common \
    build-essential \
    xvfb \
    x11-utils \
    xdotool \
    wmctrl \
    gnome-screenshot \
    avahi-daemon \
    gvfs \
    at-spi2-core \
    curl \
    wget \
    git \
    libx11-dev \
    libxtst-dev \
    libxinerama-dev \
    libxrandr-dev \
    libxi-dev \
    dbus-x11 \
    x11vnc \
    xterm \
    xfce4 \
    xfce4-terminal \
    xfce4-taskmanager \
    thunar \
    mousepad \
    gnome-calculator \
    adwaita-icon-theme \
    gnome-icon-theme \
    gtk2-engines-murrine \
    sudo \
    && add-apt-repository ppa:deadsnakes/ppa \
    && apt-get update && apt-get install -y \
    python3.11 \
    python3.11-venv \
    python3.11-dev \
    python3-pip \
    python3.11-tk \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install Google Chrome (bypasses Snap limitation)
RUN apt-get update && \
    wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb && \
    apt-get install -y ./google-chrome-stable_current_amd64.deb && \
    rm google-chrome-stable_current_amd64.deb && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Create non-root user — fixes Chrome, Electron, and any app that blocks root
RUN useradd -m -s /bin/bash computeruse && \
    echo "computeruse ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

ENV VIRTUAL_ENV=/opt/venv
RUN python3.11 -m venv $VIRTUAL_ENV && \
    chown -R computeruse:computeruse $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

RUN pip install --upgrade pip setuptools wheel websockify
RUN pip install --retries 5 --timeout 60 orbit-cua==0.2.13 python-dotenv pillow ddgs
RUN pip install --retries 5 --timeout 60 fastapi uvicorn

# App code lives in /app — not mounted, never hidden by volumes
RUN mkdir -p /app && chown computeruse:computeruse /app
WORKDIR /app
COPY --chown=computeruse:computeruse backend.py codegen.py state.py /app/

# /workspace is the data directory — mounted as a volume by docker compose
RUN mkdir -p /workspace && chown computeruse:computeruse /workspace

# Pre-seed XFCE config for computeruse
RUN mkdir -p /home/computeruse/.config/xfce4/xfconf/xfce-perchannel-xml && \
    cat > /home/computeruse/.config/xfce4/xfconf/xfce-perchannel-xml/xfwm4.xml <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<channel name="xfwm4" version="1.0">
  <property name="general" type="empty">
    <property name="theme" type="string" value="Default"/>
  </property>
</channel>
EOF
RUN mkdir -p /home/computeruse/Desktop /home/computeruse/Downloads /home/computeruse/Documents && \
    touch /home/computeruse/.Xauthority && \
    chown -R computeruse:computeruse /home/computeruse

EXPOSE 7878 6080 8000

USER computeruse

# Start sequence wrapped in dbus-run-session so desktop and Orbit share
# the same D-Bus session and AT-SPI accessibility tree.
# at-spi paths are /usr/libexec/ on Ubuntu 24.04 (not /usr/lib/at-spi2-core/)
CMD ["sh", "-c", "rm -rf /home/computeruse/.cache/at-spi /tmp/dbus-* && dbus-run-session -- sh -c '\
  Xvfb :99 -screen 0 1280x768x24 -ac & \
  sleep 2 && DISPLAY=:99 xfce4-session & \
  sleep 3 && DISPLAY=:99 /usr/libexec/at-spi-bus-launcher --launch-immediately & \
  sleep 1 && DISPLAY=:99 /usr/libexec/at-spi2-registryd & \
  sleep 3 && x11vnc -display :99 -nopw -forever -shared -rfbport 5900 & \
  sleep 1 && websockify 6080 localhost:5900 & \
  until DISPLAY=:99 xdpyinfo >/dev/null 2>&1; do sleep 1; done && \
  echo Desktop ready && \
  sleep 5 && DISPLAY=:99 python /app/backend.py \
'"]
