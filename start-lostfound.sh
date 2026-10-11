#!/data/data/com.termux/files/usr/bin/bash

cd ~/lostfound

echo "======================================"
echo "      LostFound Algeria"
echo "======================================"

echo "[1/3] إيقاف العمليات القديمة..."
pkill -f "node server.js" 2>/dev/null
pkill -f "cloudflared tunnel --url" 2>/dev/null
sleep 2

echo "[2/3] تشغيل خادم LostFound..."
node server.js > ~/lostfound/server.log 2>&1 &
NODE_PID=$!

sleep 3

if ! kill -0 "$NODE_PID" 2>/dev/null; then
    echo "❌ فشل تشغيل خادم LostFound"
    cat ~/lostfound/server.log
    exit 1
fi

echo "✅ خادم LostFound يعمل على:"
echo "   http://127.0.0.1:3000"

echo "[3/3] تشغيل Cloudflare Tunnel..."
rm -f ~/lostfound/cloudflare.log

cloudflared tunnel --url http://127.0.0.1:3000 > ~/lostfound/cloudflare.log 2>&1 &
CF_PID=$!

echo "⏳ انتظار رابط Cloudflare..."

URL=""

for i in $(seq 1 30); do
    sleep 1

    URL=$(grep -oE 'https://[-a-zA-Z0-9]+\.trycloudflare\.com' ~/lostfound/cloudflare.log | head -n 1)

    if [ -n "$URL" ]; then
        break
    fi
done

echo ""
echo "======================================"

if [ -n "$URL" ]; then
    echo "✅ LostFound متاح الآن:"
    echo ""
    echo "$URL"
    echo ""
    echo "🌐 سيتم فتح الرابط في المتصفح..."
    echo "======================================"

    am start -a android.intent.action.VIEW -d "$URL" >/dev/null 2>&1

    echo ""
    echo "لإيقاف الموقع:"
    echo "اضغط CTRL+C"
    echo ""

    wait "$CF_PID"
else
    echo "❌ لم يتم الحصول على رابط Cloudflare."
    echo ""
    echo "آخر رسائل Cloudflare:"
    tail -n 20 ~/lostfound/cloudflare.log
    kill "$CF_PID" 2>/dev/null
    exit 1
fi
