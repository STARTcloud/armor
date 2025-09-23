#!/bin/sh
# Sources:
#  https://www.tobanet.de/s/2017/11/create-your-own-debian-mirror-with-debmirror/
#  https://louwrentius.com/how-to-setup-a-local-or-private-ubuntu-mirror.html
#  https://low-level.wiki/mirrors/ubuntu_repos.html
#  https://help.ubuntu.com/community/Debmirror
#  https://earthly.dev/blog/creating-and-hosting-your-own-deb-packages-and-apt-repo/

set -e

do_hash() {
    HASH_NAME=$1
    HASH_CMD=$2
    echo "${HASH_NAME}:"
    for f in $(find -type f); do
        f=$(echo $f | cut -c3-) # remove ./ prefix
        if [ "$f" = "Release" ]; then
            continue
        fi
        echo " $(${HASH_CMD} ${f}  | cut -d" " -f1) $(wc -c $f)"
    done
}

cat << EOF
Origin: STARTcloud
Label: startcloud
Suite: ${1:-trixie}
Codename: ${1:-trixie}
Version: 1.0
Architectures: amd64 arm64
Components: main
Description: STARTcloud - Own your Data
Date: $(date -Ru)
EOF
do_hash "MD5Sum" "md5sum"
do_hash "SHA1" "sha1sum"
do_hash "SHA256" "sha256sum"
