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

# Docker blocks the kernel namespaces Chrome's sandbox requires — --no-sandbox
# and --disable-dev-shm-usage are needed in every Docker environment regardless
# of which user runs the container. Wrap the binary so all launch paths get the flags.
RUN mv /usr/bin/google-chrome-stable /usr/bin/google-chrome-stable.real && \
    printf '#!/bin/sh\n# Clear stale profile lock left by previous container instance\nrm -f /root/.config/google-chrome/SingletonLock \\\n      /root/.config/google-chrome/SingletonCookie \\\n      /root/.config/google-chrome/SingletonSocket\nexec /usr/bin/google-chrome-stable.real --no-sandbox --disable-dev-shm-usage "$@"\n' \
        > /usr/bin/google-chrome-stable && \
    chmod +x /usr/bin/google-chrome-stable && \
    ln -sf /usr/bin/google-chrome-stable /usr/bin/google-chrome

ENV VIRTUAL_ENV=/opt/venv
RUN python3.11 -m venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

RUN pip install --upgrade pip setuptools wheel websockify
RUN pip install --retries 5 --timeout 60 orbit-cua==0.2.22 python-dotenv pillow ddgs pandas
RUN pip install --retries 5 --timeout 60 fastapi uvicorn playwright
RUN playwright install chromium --with-deps


# Pre-seed XFCE config running as root to avoid D-Bus permission issues
RUN mkdir -p /root/.config/xfce4/xfconf/xfce-perchannel-xml && \
    cat > /root/.config/xfce4/xfconf/xfce-perchannel-xml/xfwm4.xml <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<channel name="xfwm4" version="1.0">
  <property name="general" type="empty">
    <property name="theme" type="string" value="Default"/>
  </property>
</channel>
EOF

RUN touch /root/.Xauthority
RUN mkdir -p /root/Desktop /root/Downloads /root/Documents \
             /home/ubuntu/Desktop /home/ubuntu/Downloads /home/ubuntu/Documents \
             /home/computeruse/Desktop /home/computeruse/Downloads && \
    chmod -R 777 /root/Desktop /home/ubuntu /home/computeruse || true

# App code lives in /app — not mounted, never hidden by volumes
WORKDIR /app
COPY backend.py codegen.py state.py /app/

# /workspace is the data directory — mounted as a volume by docker compose
RUN mkdir -p /workspace

EXPOSE 7878 6080 8000

# Start sequence:
# 1. Nuke any stale singleton locks from the mounted chrome-profile volume FIRST,
#    before dbus-run-session, so they're always cleared even if dbus setup fails.
#    (Playwright uses its own Chromium binary, not the wrapper above, so we must
#     do this cleanup here rather than relying on the wrapper script.)
# 2. Gate on Xvfb actually accepting connections before starting the WM.
# 3. Gate on the WM being ready before starting Python — avoids Chrome SIGTRAP
#    when it tries to create a window before the WM is initialized.
CMD ["sh", "-c", "\
  rm -f /root/.config/google-chrome/SingletonLock \
        /root/.config/google-chrome/SingletonCookie \
        /root/.config/google-chrome/SingletonSocket && \
  rm -rf /root/.cache/at-spi /tmp/dbus-* && \
  dbus-run-session -- sh -c '\
    Xvfb :99 -screen 0 1280x768x24 -ac & \
    until DISPLAY=:99 xdpyinfo >/dev/null 2>&1; do sleep 1; done && \
    DISPLAY=:99 xfce4-session & \
    DISPLAY=:99 /usr/libexec/at-spi-bus-launcher --launch-immediately & \
    DISPLAY=:99 /usr/libexec/at-spi2-registryd & \
    x11vnc -display :99 -nopw -forever -shared -rfbport 5900 & \
    websockify 6080 localhost:5900 & \
    until DISPLAY=:99 wmctrl -m >/dev/null 2>&1; do sleep 1; done && \
    echo \"Desktop ready\" && \
    DISPLAY=:99 python /app/backend.py \
  '"]
  