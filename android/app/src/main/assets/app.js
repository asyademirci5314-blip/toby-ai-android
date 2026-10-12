
const $ = (id) => document.getElementById(id);


// API bağlantısı: girişten sonra sunucu oturumu kullanılır.
async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  const response = await fetch(path, {
    ...options,
    headers,
    credentials: "same-origin"
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Bir hata oluştu.");
  }
  return data;
}

// Android cihazında yerel PIN girişi
$("loginForm")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const pin = $("pinInput").value;
  const message = $("loginMessage");

  if (!/^[0-9]{4}$/.test(pin)) {
    message.textContent = "4 rakamlı PIN gir.";
    return;
  }

  if (!window.TobyAndroid) {
    message.textContent = "Android bağlantısı bulunamadı.";
    return;
  }

  const result = window.TobyAndroid.verifyOrSetPin(pin);

  if (result === "SET" || result === "OK") {
    $("loginScreen").hidden = true;
    $("appContent").hidden = false;
    $("pinInput").value = "";
    message.textContent = "";
    $("status").textContent = "Toby hazır";
    $("result").textContent =
      result === "SET"
        ? "PIN oluşturuldu. Hoş geldin!"
        : "Giriş başarılı. Hoş geldin!";
  } else {
    message.textContent =
      result === "WRONG" ? "PIN yanlış." : "Geçerli bir PIN gir.";
    $("pinInput").value = "";
  }
});

$("logoutButton")?.addEventListener("click", () => {
  $("appContent").hidden = true;
  $("loginScreen").hidden = false;
  $("pinInput").value = "";
  $("loginMessage").textContent = "Toby kilitlendi.";
});

// Toby konuşsun
function tobySpeak(message) {
  const status = $("voiceStatus");
  if (status) status.textContent = message;

  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();

    const speech = new SpeechSynthesisUtterance(message);
    speech.lang = "tr-TR";
    speech.rate = 1;
    window.speechSynthesis.speak(speech);
  }
}

// Yerel uygulama durumu
$("testButton")?.addEventListener("click", () => {
  $("status").textContent = "Toby cihazında çalışıyor";
  $("result").textContent =
    "Arayüz hazır. İnternet gerektiren bir yapay zekâ bağlantısı henüz eklenmedi.";
});

// 2. Parlaklık
$("brightness")?.addEventListener("input", (event) => {
  $("brightnessValue").textContent = `%${event.target.value}`;
});

function setBrightness(percent) {
  if (!Number.isInteger(percent) || percent < 10 || percent > 100) {
    tobySpeak("Parlaklık yüzde 10 ile 100 arasında olmalı.");
    return;
  }

  if (!window.TobyAndroid) {
    tobySpeak("Android bağlantısı bulunamadı.");
    return;
  }

  $("brightness").value = percent;
  $("brightnessValue").textContent = "%" + percent;

  if (!confirm("Uygulama penceresinin parlaklığı yüzde " +
      percent + " olsun mu?")) {
    tobySpeak("İşlem iptal edildi.");
    return;
  }

  window.TobyAndroid.setBrightness(percent);
  tobySpeak("Uygulama penceresinin parlaklığı ayarlandı.");
}

$("brightnessButton")?.addEventListener("click", () => {
  setBrightness(Number($("brightness").value));
});

// 3. WhatsApp mesajı hazırla
$("whatsappButton")?.addEventListener("click", () => {
  const phone = $("phone").value.replace(/\D/g, "");
  const message = $("message").value.trim();

  if (!phone || phone.length < 10 || phone.length > 15) {
    alert("Ülke koduyla birlikte geçerli bir telefon numarası gir. Örnek: 905xxxxxxxxx");
    return;
  }

  if (!message) {
    alert("Önce mesajını yaz.");
    return;
  }

  if (!confirm("WhatsApp sohbetini hazırlanan mesajla açalım mı?")) {
    return;
  }

  const link = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  window.open(link, "_blank", "noopener,noreferrer");
});

// 4. Sesli komut sistemi
const voiceButton = $("voiceButton");
const voiceStatus = $("voiceStatus");

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

let recognition = null;
let listening = false;

if (voiceButton && voiceStatus) {
  if (!SpeechRecognition) {
    voiceStatus.textContent =
      "Bu tarayıcı ses tanımayı desteklemiyor. Toby'yi Chrome'da dene.";
    voiceButton.disabled = true;
  } else {
    recognition = new SpeechRecognition();
    recognition.lang = "tr-TR";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      listening = true;
      voiceButton.textContent = "🔴 Dinliyorum...";
      voiceStatus.textContent = "Seni dinliyorum...";
    };

    recognition.onend = () => {
      listening = false;
      voiceButton.textContent = "🎙️ Toby, beni dinle";
    };

    recognition.onerror = (event) => {
      listening = false;
      voiceStatus.textContent =
        "Ses tanıma hatası: " + event.error +
        ". Mikrofon iznini ve internet bağlantısını kontrol et.";
    };

    recognition.onresult = (event) => {
      const command = event.results[0][0].transcript
        .toLocaleLowerCase("tr-TR")
        .replace(/[.,!?]/g, "")
        .trim();

      voiceStatus.textContent = "Duyduğum: " + command;

      // Saati söyle
      if (
        command.includes("saat kaç") ||
        command.includes("saati söyle")
      ) {
        const time = new Date().toLocaleTimeString("tr-TR", {
          hour: "2-digit",
          minute: "2-digit"
        });

        tobySpeak("Saat şu an " + time);
        return;
      }

      // Parlaklığı ayarla
      if (command.includes("parlaklık")) {
        const match = command.match(/(\d{1,3})/);
        const percent = match ? Number(match[1]) : 50;

        if (percent < 10 || percent > 100) {
          tobySpeak("Lütfen yüzde 10 ile 100 arasında bir değer söyle.");
          return;
        }

        $("brightness").value = percent;
        $("brightnessValue").textContent = `%${percent}`;

        $("brightnessButton").scrollIntoView({
          behavior: "smooth",
          block: "center"
        });

        tobySpeak(
          "Parlaklık yüzde " + percent +
          " olarak ayarlandı. Gerçekten uygulamak için Parlaklığı uygula düğmesine bas."
        );
        return;
      }

      // WhatsApp bölümüne git
      if (
        command.includes("whatsapp") ||
        command.includes("mesaj hazırla")
      ) {
        $("whatsappButton").scrollIntoView({
          behavior: "smooth",
          block: "center"
        });

        tobySpeak("WhatsApp bölümünü açtım. Numara ve mesajı gir.");
        return;
      }

      // Dinlemeyi durdur
      if (
        command === "dur" ||
        command.includes("dinlemeyi durdur")
      ) {
        tobySpeak("Tamam, komut bekliyorum.");
        return;
      }

      tobySpeak(
        "Seni duydum. Şimdilik saat, parlaklık ve WhatsApp komutlarını kullanabiliyorum."
      );
    };

    voiceButton.addEventListener("click", () => {
      if (listening) {
        recognition.stop();
        return;
      }

      try {
        recognition.start();
      } catch (error) {
        voiceStatus.textContent =
          "Sesli komut başlatılamadı. Birkaç saniye sonra tekrar dene.";
      }
    });
  }
}
