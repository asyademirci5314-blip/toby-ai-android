
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

/* Toby: cihazda saklanan notlar ve hafiza */
(() => {
  const el = (id) => document.getElementById(id);
  const NOTES_KEY = "toby_notes_v1";
  const MEMORY_KEY = "toby_memory_v1";

  function read(key) {
    try {
      const data = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(data) ? data : [];
    } catch (_) {
      return [];
    }
  }

  function save(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (_) {
      return false;
    }
  }

  function message(id, text) {
    if (el(id)) el(id).textContent = text;
  }

  function node(tag, className, text) {
    const item = document.createElement(tag);
    if (className) item.className = className;
    if (text !== undefined) item.textContent = text;
    return item;
  }

  function render(key, listId, messageId, isNote) {
    const list = el(listId);
    if (!list) return;
    list.replaceChildren();

    const items = read(key);
    if (!items.length) {
      list.appendChild(node("p", "", isNote
        ? "Henüz kayıtlı notun yok."
        : "Hafızada henüz bilgi yok."));
      return;
    }

    items.slice().reverse().forEach((item) => {
      const card = node("article", "local-item");

      if (isNote) {
        card.appendChild(node("div", "local-item-title", item.title));
      }
      card.appendChild(node("div", "", isNote ? item.text : item.text));
      card.appendChild(node("div", "local-item-date", item.date));

      const remove = node("button", "", isNote ? "🗑️ Notu sil" : "🗑️ Bilgiyi sil");
      remove.type = "button";
      remove.addEventListener("click", () => {
        if (!confirm(isNote ? "Bu not silinsin mi?" : "Bu bilgi silinsin mi?")) return;
        const updated = read(key).filter((entry) => entry.id !== item.id);
        if (!save(key, updated)) {
          message(messageId, "Kaydedilemedi. Cihaz depolamasını kontrol et.");
          return;
        }
        message(messageId, "Silindi.");
        render(key, listId, messageId, isNote);
      });

      card.appendChild(remove);
      list.appendChild(card);
    });
  }

  el("saveNoteButton")?.addEventListener("click", () => {
    const title = el("notesTitle").value.trim() || "Başlıksız not";
    const text = el("notesText").value.trim();

    if (!text) {
      message("notesMessage", "Önce notunun içeriğini yaz.");
      return;
    }

    const items = read(NOTES_KEY);
    items.push({
      id: Date.now().toString() + Math.random().toString(16).slice(2),
      title,
      text,
      date: new Date().toLocaleString("tr-TR")
    });

    if (!save(NOTES_KEY, items)) {
      message("notesMessage", "Kayıt yapılamadı. Depolama alanını kontrol et.");
      return;
    }

    el("notesTitle").value = "";
    el("notesText").value = "";
    message("notesMessage", "Not cihazına kaydedildi.");
    render(NOTES_KEY, "notesList", "notesMessage", true);
  });

  el("saveMemoryButton")?.addEventListener("click", () => {
    const text = el("memoryText").value.trim();

    if (!text) {
      message("memoryMessage", "Önce hatırlanacak bilgiyi yaz.");
      return;
    }

    const items = read(MEMORY_KEY);
    items.push({
      id: Date.now().toString() + Math.random().toString(16).slice(2),
      text,
      date: new Date().toLocaleString("tr-TR")
    });

    if (!save(MEMORY_KEY, items)) {
      message("memoryMessage", "Kayıt yapılamadı. Depolama alanını kontrol et.");
      return;
    }

    el("memoryText").value = "";
    message("memoryMessage", "Bilgi Toby'nin yerel hafızasına kaydedildi.");
    render(MEMORY_KEY, "memoryList", "memoryMessage", false);
  });

  try {
    render(NOTES_KEY, "notesList", "notesMessage", true);
    render(MEMORY_KEY, "memoryList", "memoryMessage", false);
  } catch (_) {
    message("notesMessage", "Notlar yüklenirken sorun oluştu.");
    message("memoryMessage", "Hafıza yüklenirken sorun oluştu.");
  }
})();
