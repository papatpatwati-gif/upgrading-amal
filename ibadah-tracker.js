(function(){
const STORAGE_KEY="ibadahDailyLogs_v3_ramadhan";

// --- Elemen DOM ---
const tglInput = document.getElementById("tglIbadah");
const sholatInput = document.getElementById("sholatWajib");
const tilawahInput = document.getElementById("tilawah");
const dzikirInput = document.getElementById("dzikir");
const sedekahInput = document.getElementById("sedekah");
const lisanInput = document.getElementById("lisan");
const catatanInput = document.getElementById("catatanIbadah");

const voiceBtn = document.getElementById("voiceBtn");
const voiceStatus = document.getElementById("voiceStatus");

const quranSurahSelect = document.getElementById("quranSurah");
const quranAyatStartInput = document.getElementById("quranAyatStart");
const quranAyatEndInput = document.getElementById("quranAyatEnd");

const btnDapatkanTafsir = document.getElementById("btnDapatkanTafsir");
const tafsirResultContainer = document.getElementById("tafsirResultContainer");

// --- New Prayer Schedule DOM Elements ---
const prayerCitySelect = document.getElementById("prayerCitySelect");
const fajrTimeEl = document.getElementById("fajrTime");
const dhuhrTimeEl = document.getElementById("dhuhrTime");
const asrTimeEl = document.getElementById("asrTime");
const maghribTimeEl = document.getElementById("maghribTime");
const ishaTimeEl = document.getElementById("ishaTime");
const nextPrayerNameEl = document.getElementById("nextPrayerName");
const countdownTimeEl = document.getElementById("countdownTime");


const shaumCk = document.getElementById("shaumSunnah");
const dhuhaCk = document.getElementById("dhuha");
const tahajudCk = document.getElementById("tahajud");
const bacaBukuCk = document.getElementById("bacaBuku");
const majlisCk = document.getElementById("majlis");
const silaturahmiCk = document.getElementById("silaturahmi");

const btnSimpan = document.getElementById("simpanIbadah");
const btnHapusAll = document.getElementById("hapusSemuaIbadah");

const jumlahHariEl = document.getElementById("jumlahHariIbadah");
const rataSkorEl = document.getElementById("rataSkorIbadah");
const riwayatEl = document.getElementById("riwayatIbadah");

const rataSkorSholatEl = document.getElementById("rataSkorSholat");
const rataSkorTilawahEl = document.getElementById("rataSkorTilawah");
const rataSkorDzikirEl = document.getElementById("rataSkorDzikir");
const rataSkorSedekahEl = document.getElementById("rataSkorSedekah");
const rataSkorLisanEl = document.getElementById("rataSkorLisan");
const fokusPerbaikanEl = document.getElementById("fokusPerbaikan");

const quranProgressBar = document.getElementById("quranProgressBar");
const juzDibacaEl = document.getElementById("juzDibaca");
const progressRamadhanContainer = document.getElementById("progressRamadhanContainer");

// chart setup
let riwayatChart=null;
const chartCanvas=document.getElementById("riwayatIbadahChart");
let chartCtx=null;
if(chartCanvas) chartCtx=chartCanvas.getContext("2d");

if (tglInput) tglInput.value=new Date().toISOString().split("T")[0];

// ====== DATA QURAN (FIXED LOGIC) ======
// --- Prayer Schedule Constants ---
const PRAYER_TIMES_API_URL = "https://api.aladhan.com/v1/timingsByCity";
const DEFAULT_PRAYER_CITY = "Jakarta"; // Default city if none saved
const PRAYER_CITIES = [
  "Jakarta", "Surabaya", "Bandung", "Medan", "Semarang", "Makassar",
  "Palembang", "Denpasar", "Yogyakarta", "Banda Aceh", "Padang", "Pekanbaru",
  "Malang", "Solo", "Manado", "Pontianak", "Samarinda", "Banjarmasin",
  "Balikpapan", "Jayapura", "Sukabumi", "Cianjur",
];
let currentPrayerTimes = null; // Stores fetched prayer times for the day
let countdownIntervalId = null; // To clear the countdown interval
let surahData = [];

async function fetchAndPopulateSurah() {
  try {
    const response = await fetch('https://api.quran.gading.dev/surah');
    if (!response.ok) throw new Error('Gagal memuat daftar surat');
    const data = await response.json();
    surahData = data.data; 

    if (quranSurahSelect) {
      quranSurahSelect.innerHTML = '<option value="">Pilih Surat...</option>';
      surahData.forEach(surah => {
        const option = document.createElement('option');
        option.value = surah.number;
        option.textContent = `${surah.number}. ${surah.name.transliteration.id}`;
        option.dataset.ayat = surah.numberOfVerses;
        quranSurahSelect.appendChild(option);
      });
    }
  } catch (error) {
    console.error("Error fetching surah list:", error);
  }
}

if (quranSurahSelect) {
  quranSurahSelect.addEventListener('change', function() {
    const selectedOption = this.options[this.selectedIndex];
    const maxAyat = selectedOption.dataset.ayat;
    if (quranAyatStartInput && maxAyat) {
      quranAyatStartInput.max = maxAyat;
      quranAyatStartInput.placeholder = `1 - ${maxAyat}`;
    }
  });
}
function loadData(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    if(!raw) return [];
    const parsed=JSON.parse(raw);
    return Array.isArray(parsed)?parsed:[];
  }catch(e){ return []; }
}

function saveData(arr){
  localStorage.setItem(STORAGE_KEY,JSON.stringify(arr));
}

// ====== GENERIC AI CALL FUNCTION ======
async function getAiResponse(prompt) {
  // GANTI baris di bawah ini dengan URL Cloud Run kamu
  const API_URL = 'https://upgrading-amal.vercel.app/api';

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    if (!response.ok) {
      // Coba baca error sebagai JSON, jika gagal, baca sebagai teks biasa.
      let errorMsg = `HTTP error! status: ${response.status}`;
      const errorText = await response.text(); // Baca body sebagai teks sekali saja.
      try {
        // Coba parse teks tersebut sebagai JSON
        const errorData = JSON.parse(errorText);
        errorMsg = errorData.error || JSON.stringify(errorData);
      } catch (e) {
        // Jika gagal parse, berarti errornya adalah teks biasa atau HTML
        errorMsg = errorText;
      }
      throw new Error(errorMsg);
    }
    const result = await response.json();
    return result.suggestion || "AI tidak memberikan respons yang valid.";
  } catch (error) {
    console.error("AI Fetch Error:", error);
    return `Maaf, terjadi kesalahan saat menghubungi AI. (${error.message})`;
  }
}

// ====== AI SUGGESTION LOGIC ======
async function getAiFocusSuggestion(data) {
  const sorted = [...data].sort((a, b) => a.tgl < b.tgl ? 1 : -1);
  const recentData = sorted.slice(0, 7);
  const dataForPrompt = recentData.map(d =>
    `- Tgl ${d.tgl}: Skor ${d.totalSkor}. Rincian: Sholat ${d.sholat}, Tilawah ${d.tilawah}, Dzikir ${d.dzikir}, Sedekah ${d.sedekah}, Lisan ${d.lisan}. ${
      d.quran && d.quran.surahId ? `Bacaan Quran: Surat ke-${d.quran.surahId} ayat ${d.quran.start} sampai ${d.quran.end}.` : ''
    } Catatan: "${d.catatan || 'Tidak ada catatan.'}"`
  ).join('\n');

  const prompt = `
  Anda adalah "Murabbi Digital", seorang mentor spiritual Islami yang memiliki kedalaman ilmu, kelembutan hati, dan kemampuan analisis yang tajam namun empatik. 

  Tugas Anda adalah menganalisis data evaluasi ibadah harian saya selama 7 hari terakhir:
  ---
  ${dataForPrompt}
  ---
  Konteks saat ini adalah bulan Ramadhan.
  Berikan bimbingan dengan struktur berikut:

  1. **Sapaan & Analisis Ruhani**: awali dengan ucapan Assalamu alaikum, Berikan apresiasi atas upaya saya untuk tetap istiqomah. Analisis tren ibadah saya dalam 2-3 kalimat. Jika Anda melihat adanya penurunan skor yang berkorelasi dengan catatan harian (misal: "sedang sibuk" atau "kurang sehat"), sebutkan dengan nada yang memaklumi namun tetap memotivasi.

  2. **Satu Titik Fokus (The Core Improvement)**: Identifikasi satu area ibadah yang paling krusial untuk diperbaiki berdasarkan data. Berikan saran praktis yang sangat spesifik dan mudah dilakukan besok pagi.

  3. **Landasan Wahyu**: Sajikan satu Ayat Al-Qur'an atau Hadits yang paling relevan dengan kondisi saya saat ini. 
     - Tuliskan teks Arab dengan harakat yang jelas.
     - Tuliskan terjemahan bahasa Indonesianya.
     - Berikan ulasan singkat (1 kalimat) mengapa ayat/hadits ini cocok untuk saya.

  4. **Doa Penutup**: Berikan satu baris doa singkat dalam bahasa Indonesia agar saya diberi kekuatan.

  **Gaya Bahasa**: Gunakan pilihan kata yang sejuk (seperti: "Anakku", "Sahabatku", "Jiwa yang tenang", "Istiqomah"). Hindari kata-kata yang menghakimi seperti "Anda buruk" atau "Anda kurang". Gunakan pendekatan psikologi positif yang dibalut nilai-nilai islami.
`;

  return getAiResponse(prompt);
}

// ====== CHART RENDER ======
function renderChartFromData(data){
  if(!chartCtx) return;
  if(!data.length){
    if(riwayatChart){ riwayatChart.destroy(); riwayatChart=null; }
    return;
  }
  const sorted=[...data].sort((a,b)=>a.tgl<b.tgl?1:-1);
  const maxShow=14;
  const potong=sorted.slice(0,maxShow).reverse();
  const labels=potong.map(d=> d.tgl ? d.tgl.split("-").reverse().slice(0,2).join("/") : "");
  const skorData=potong.map(d=>d.totalSkor||0);

  if(riwayatChart){
    riwayatChart.data.labels=labels;
    riwayatChart.data.datasets[0].data=skorData;
    riwayatChart.update();
  }else{
    riwayatChart=new Chart(chartCtx,{
      type:"bar",
      data:{
        labels:labels,
        datasets:[{
          label:"Skor total",
          data:skorData,
          backgroundColor:"rgba(25,135,84,0.2)",
          borderColor:"rgba(25,135,84,1)",
          borderWidth:1.5
        }]
      },
      options:{ responsive:true, maintainAspectRatio:false }
    });
  }
}

// ====== QURAN PROGRESS CALCULATOR ======
function calculateQuranProgress(data) {
  if (!data || !data.length || !surahData.length) return { totalAyatDibaca: 0, totalJuzDibaca: 0 };

  const TOTAL_AYAT_QURAN = 6236; 
  const JUZ_PER_AYAT = TOTAL_AYAT_QURAN / 30;
  let totalAyatDibaca = 0;
  const ayatSudahDihitung = new Set();
  const ayatPerSurah = {};
  let ayatGlobalCounter = 0;
  
  const sortedSurahData = [...surahData].sort((a, b) => a.number - b.number);
  for (const surah of sortedSurahData) {
    ayatPerSurah[surah.number] = { start: ayatGlobalCounter + 1 };
    ayatGlobalCounter += surah.numberOfVerses;
  }

  for (const log of data) {
    if (log.quran && log.quran.surahId) {
      const { surahId, start, end } = log.quran;
      const infoSurah = ayatPerSurah[surahId];
      if (infoSurah) {
        for (let i = start; i <= end; i++) {
          const ayatGlobal = infoSurah.start + i - 1;
          if (!ayatSudahDihitung.has(ayatGlobal)) {
            ayatSudahDihitung.add(ayatGlobal);
            totalAyatDibaca++;
          }
        }
      }
    }
  }
  return { totalAyatDibaca, totalJuzDibaca: totalAyatDibaca / JUZ_PER_AYAT };
}

// ====== PRAYER SCHEDULE LOGIC ======
function populatePrayerCities() {
  if (!prayerCitySelect) return;
  prayerCitySelect.innerHTML = '';
  PRAYER_CITIES.forEach(city => {
    const option = document.createElement('option');
    option.value = city;
    option.textContent = city;
    prayerCitySelect.appendChild(option);
  });

  const savedCity = localStorage.getItem('selectedPrayerCity') || DEFAULT_PRAYER_CITY;
  if (PRAYER_CITIES.includes(savedCity)) {
    prayerCitySelect.value = savedCity;
  } else {
    prayerCitySelect.value = DEFAULT_PRAYER_CITY;
    localStorage.setItem('selectedPrayerCity', DEFAULT_PRAYER_CITY);
  }
}

async function fetchAndDisplayPrayerTimes(city) {
  if (!fajrTimeEl) return; // Only run if prayer schedule elements exist

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1; // Months are 0-indexed
  const day = today.getDate();

  try {
    // Show loading state
    [fajrTimeEl, dhuhrTimeEl, asrTimeEl, maghribTimeEl, ishaTimeEl].forEach(el => el.textContent = '--:--');
    if (nextPrayerNameEl) nextPrayerNameEl.textContent = '--';
    if (countdownTimeEl) countdownTimeEl.textContent = '--:--:--';

    const response = await fetch(`${PRAYER_TIMES_API_URL}?city=${city}&country=ID&method=8`); // Method 8 for Kemenag RI
    if (!response.ok) throw new Error('Gagal memuat jadwal sholat');
    const data = await response.json();

    if (data.data && data.data.timings) {
      const timings = data.data.timings;
      currentPrayerTimes = {
        Fajr: timings.Fajr,
        Dhuhr: timings.Dhuhr,
        Asr: timings.Asr,
        Maghrib: timings.Maghrib,
        Isha: timings.Isha,
      };

      fajrTimeEl.textContent = timings.Fajr;
      dhuhrTimeEl.textContent = timings.Dhuhr;
      asrTimeEl.textContent = timings.Asr;
      maghribTimeEl.textContent = timings.Maghrib;
      ishaTimeEl.textContent = timings.Isha;

      if (countdownIntervalId) clearInterval(countdownIntervalId);
      countdownIntervalId = setInterval(updateCountdown, 1000);
      updateCountdown(); // Initial call
    } else {
      console.error("Invalid prayer times data:", data);
      throw new Error("Data jadwal sholat tidak valid.");
    }
  } catch (error) {
    console.error("Error fetching prayer times:", error);
    // Display error message to user
    [fajrTimeEl, dhuhrTimeEl, asrTimeEl, maghribTimeEl, ishaTimeEl].forEach(el => el.textContent = 'Error');
    if (nextPrayerNameEl) nextPrayerNameEl.textContent = 'Error';
    if (countdownTimeEl) countdownTimeEl.textContent = 'Error';
  }
}

function updateCountdown() {
  if (!currentPrayerTimes || !nextPrayerNameEl || !countdownTimeEl) return;

  const now = new Date();
  const prayerNames = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
  let nextPrayer = null;
  let nextPrayerTime = null;

  // Try to find the next prayer for today
  for (const name of prayerNames) {
    const timeStr = currentPrayerTimes[name];
    if (!timeStr) continue;

    const [hours, minutes] = timeStr.split(':').map(Number);
    const prayerDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);

    if (prayerDate > now) {
      nextPrayer = name;
      nextPrayerTime = prayerDate;
      break;
    }
  }

  if (nextPrayer && nextPrayerTime) {
    const diff = nextPrayerTime.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    nextPrayerNameEl.textContent = nextPrayer;
    countdownTimeEl.textContent =
      `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  } else {
    // All prayers for today are over.
    nextPrayerNameEl.textContent = 'Hari ini selesai';
    countdownTimeEl.textContent = '00:00:00';
    if (countdownIntervalId) {
      clearInterval(countdownIntervalId);
      countdownIntervalId = null;
    }
  }
}

// ====== MAIN RENDER DATA ======
async function renderData(){
  let data=loadData();
  
  // Ringkasan Dashboard
  if (jumlahHariEl) {
    jumlahHariEl.textContent = data.length;
    if (data.length > 0) {
      const totalSkor = data.reduce((sum, d) => sum + (d.totalSkor || 0), 0);
      rataSkorEl.textContent = (totalSkor / data.length).toFixed(1);
      
      if (rataSkorSholatEl) {
        rataSkorSholatEl.textContent = (data.reduce((s, d) => s + (d.sholat || 0), 0) / data.length).toFixed(1);
        rataSkorTilawahEl.textContent = (data.reduce((s, d) => s + (d.tilawah || 0), 0) / data.length).toFixed(1);
        rataSkorDzikirEl.textContent = (data.reduce((s, d) => s + (d.dzikir || 0), 0) / data.length).toFixed(1);
        rataSkorSedekahEl.textContent = (data.reduce((s, d) => s + (d.sedekah || 0), 0) / data.length).toFixed(1);
        rataSkorLisanEl.textContent = (data.reduce((s, d) => s + (d.lisan || 0), 0) / data.length).toFixed(1);
      }
    }
  }

  // Progress Quran
  if (quranProgressBar) {
    const { totalJuzDibaca } = calculateQuranProgress(data);
    const percentage = Math.min(100, (totalJuzDibaca / 30) * 100);
    quranProgressBar.style.width = `${percentage}%`;
    quranProgressBar.textContent = `${percentage.toFixed(1)}%`;
    if (juzDibacaEl) juzDibacaEl.textContent = totalJuzDibaca.toFixed(2);
  }

  // List Riwayat
  if (riwayatEl) {
    if (!data.length) {
      riwayatEl.innerHTML = '<small>Belum ada data. Silakan simpan laporan pertama Anda.</small>';
    } else {
      const sortedForList = [...data].sort((a, b) => a.tgl < b.tgl ? 1 : -1).slice(0, 14);
      riwayatEl.innerHTML = sortedForList.map(d => {
        const sunnahList = [];
        if(d.shaum) sunnahList.push("Shaum");
        if(d.dhuha) sunnahList.push("Dhuha");
        if(d.tahajud) sunnahList.push("Tahajud/Tarawih");
        if(d.bacaBuku) sunnahList.push("Baca Buku");
        if(d.majlis) sunnahList.push("Majelis");
        if(d.silaturahmi) sunnahList.push("Silaturahmi");

        const qName = surahData.find(s => s.number == d.quran?.surahId)?.name.transliteration.id || d.quran?.surahId;
        const quranLog = d.quran ? `Q.S. ${qName} : ${d.quran.start}–${d.quran.end}` : "";

        return `
          <div class="riwayat-item">
            <div class="tgl">📅 ${d.tgl}</div>
            <div>Skor total: <span class="skor">${d.totalSkor}</span> (0–15)</div>
            <div style="font-size:0.9em; margin-top:4px; color: #6b7280;">
              Sholat: ${d.sholat || 0} | Tilawah: ${d.tilawah || 0} | Dzikir: ${d.dzikir || 0} | Sedekah: ${d.sedekah || 0} | Lisan: ${d.lisan || 0}
            </div>
            ${quranLog ? `<div style="font-size:0.9em; margin-top:4px; color:#16a34a;">⭐ ${quranLog}</div>` : ""}
            ${sunnahList.length ? `<div style="font-size:0.9em; margin-top:4px; color:#107c41;">Sunnah: ${sunnahList.join(", ")}</div>` : ""}
            ${d.catatan ? `<div style="font-size:0.9em; margin-top:4px; color:#555; font-style:italic;">Catatan: ${d.catatan}</div>` : ""}
          </div>`;
      }).join("");
    }
  }

  // Grafik render
  renderChartFromData(data);

  // Fokus Perbaikan / AI Mentor Box
  if (fokusPerbaikanEl) {
    fokusPerbaikanEl.style.display = "block";
    if (data.length >= 7) {
      fokusPerbaikanEl.innerHTML = `
        <div class="fokus-perbaikan-box">
          Merasa butuh arahan? Dapatkan analisis dan saran personal dari Mentor AI berdasarkan data 7 hari terakhir Anda.
          <button id="btnMintaSaran" class="btn-ai-suggest">✨ Minta Saran dari Mentor AI</button>
        </div>`;
    } else {
      fokusPerbaikanEl.innerHTML = `<div class="fokus-perbaikan-box info-box"><h5>✨ Mentor AI Akan Datang</h5><p>Catat minimal 7 hari agar AI bisa memberikan masukan yang bermakna.</p></div>`;
    }
  }
}

// ====== EVENTS ======
if (btnSimpan) {
  btnSimpan.addEventListener("click", function() {
    const fix = v => Math.max(0, Math.min(3, isNaN(parseInt(v)) ? 0 : parseInt(v)));
    const d = {
      tgl: tglInput.value || new Date().toISOString().split("T")[0],
      sholat: fix(sholatInput.value),
      tilawah: fix(tilawahInput.value),
      dzikir: fix(dzikirInput.value),
      sedekah: fix(sedekahInput.value),
      lisan: fix(lisanInput.value),
      shaum: shaumCk.checked,
      dhuha: dhuhaCk.checked,
      tahajud: tahajudCk.checked,
      bacaBuku: bacaBukuCk.checked,
      majlis: majlisCk.checked,
      silaturahmi: silaturahmiCk.checked,
      quran: (quranSurahSelect.value && quranAyatStartInput.value) ? {
        surahId: parseInt(quranSurahSelect.value),
        start: parseInt(quranAyatStartInput.value),
        end: parseInt(quranAyatEndInput.value)
      } : null,
      catatan: catatanInput.value.trim(),
      totalSkor: fix(sholatInput.value) + fix(tilawahInput.value) + fix(dzikirInput.value) + fix(sedekahInput.value) + fix(lisanInput.value)
    };
    let arr = loadData();
    const idx = arr.findIndex(x => x.tgl === d.tgl);
    if(idx >= 0) arr[idx] = d; else arr.push(d);
    saveData(arr);
    alert("✅ Laporan berhasil disimpan!");
    window.location.href = 'riwayat.html';
  });
}

if (btnDapatkanTafsir) {
  btnDapatkanTafsir.addEventListener("click", async () => {
    const surahId = quranSurahSelect.value;
    const ayatStart = quranAyatStartInput.value;

    if (!surahId || !ayatStart) {
      alert("Silakan pilih Surat dan nomor Ayat terlebih dahulu.");
      return;
    }

    const selectedSurah = surahData.find(s => s.number == surahId);
    const surahName = selectedSurah ? selectedSurah.name.transliteration.id : `Surat ke-${surahId}`;

    btnDapatkanTafsir.disabled = true;
    btnDapatkanTafsir.textContent = '🧠 Meminta Tafsir...';
    if (tafsirResultContainer) tafsirResultContainer.innerHTML = `<p>Sedang memuat tafsir untuk <strong>Q.S. ${surahName} ayat ${ayatStart}</strong>...</p>`;

    const prompt = `
    Anda adalah seorang ahli tafsir Al-Qur'an yang sangat mendalami dan berpegang teguh pada metodologi Tafsir Ibnu Katsir.
    Tugas Anda adalah memberikan penjelasan tafsir untuk **Surat ${surahName} (Surat ke-${surahId}) ayat ${ayatStart}**.
    
    **Gunakan struktur jawaban yang ketat berikut ini:**
    1.  **Teks Ayat**: Awali dengan judul "Teks Ayat & Terjemahan". Di bawahnya, tampilkan teks Arab dari ayat tersebut dengan harakat yang jelas dan lengkap.
    2.  **Terjemahan**: Tepat di bawah teks Arab, tampilkan terjemahan resmi Kemenag RI untuk ayat tersebut.
    3.  **Tafsir Ibnu Katsir**: Buat judul baru "Tafsir Ibnu Katsir". Di bawahnya, berikan penjelasan tafsir yang merujuk langsung pada poin-poin yang dijelaskan dalam kitab Tafsir Ibnu Katsir. Jelaskan asbabun nuzul (jika ada), hubungan dengan ayat sebelumnya, dan penjelasan kata per kata atau frasa sesuai dengan yang dibahas oleh Ibnu Katsir. Gunakan gaya bahasa yang mengalir dan mudah dipahami seolah-olah Anda sedang merangkum isi kitab tersebut.
    
    **PENTING**:
    - Jangan memberikan opini pribadi atau tafsir dari sumber lain. Fokus 100% pada apa yang disampaikan dalam Tafsir Ibnu Katsir.
    - Jika Ibnu Katsir mengutip hadits atau riwayat lain untuk menjelaskan ayat tersebut, sertakan kutipan tersebut dalam penjelasan Anda.
    - Format jawaban menggunakan Markdown untuk penjudulan dan penekanan teks.
    `;
    const tafsir = await getAiResponse(prompt);
    if (tafsirResultContainer) tafsirResultContainer.innerHTML = tafsir;
  });
}

// Event listener for prayer city selection
if (prayerCitySelect) {
  prayerCitySelect.addEventListener('change', (event) => {
    const selectedCity = event.target.value;
    localStorage.setItem('selectedPrayerCity', selectedCity);
    fetchAndDisplayPrayerTimes(selectedCity);
  });
}

document.body.addEventListener('click', async function(event) {
  if (event.target && event.target.id === 'btnMintaSaran') {
    const btn = event.target;
    btn.disabled = true;
    btn.textContent = '🧠 Menganalisis...';
    const suggestion = await getAiFocusSuggestion(loadData());
    if (fokusPerbaikanEl) {
      fokusPerbaikanEl.innerHTML = suggestion;
    }
  }
});

if (btnHapusAll) {
  btnHapusAll.addEventListener("click", () => {
    if(confirm("Hapus semua data?")) { localStorage.removeItem(STORAGE_KEY); location.reload(); }
  });
}

// ====== VOICE TO TEXT FOR NOTES ======
if (voiceBtn && catatanInput) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (SpeechRecognition) {
    const recognition = new SpeechRecognition();
    recognition.lang = 'id-ID';
    recognition.continuous = false;
    recognition.interimResults = false;

    voiceBtn.addEventListener("click", () => {
      recognition.start();
      voiceStatus.classList.remove("hidden");
      voiceBtn.classList.add("animate-pulse");
      voiceBtn.style.backgroundColor = 'var(--danger-color-light)';
    });

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      catatanInput.value += (catatanInput.value ? " " : "") + transcript;
    };

    recognition.onend = () => {
      voiceStatus.classList.add("hidden");
      voiceBtn.classList.remove("animate-pulse");
      voiceBtn.style.backgroundColor = 'transparent';
    };

    recognition.onerror = (event) => {
      console.error("Speech Recognition Error:", event.error);
      alert("Maaf, mic tidak terdeteksi atau izin ditolak.");
      recognition.onend(); // Ensure UI resets on error
    };
  } else {
    voiceBtn.style.display = "none";
    console.log("Browser tidak mendukung Speech Recognition.");
  }
}

// ====== DARK MODE & INIT ======
function setupDarkMode() {
  const btn = document.getElementById('darkModeToggle');
  if(!btn) return;
  const apply = (t) => {
    document.body.classList.toggle('dark-mode', t === 'dark');
    btn.textContent = t === 'dark' ? '☀️' : '🌙';
  };
  btn.onclick = () => {
    const next = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
    localStorage.setItem('theme', next);
    apply(next);
  };
  apply(localStorage.getItem('theme') || 'light');
}

async function init() {
  setupDarkMode();
  await fetchAndPopulateSurah(); 
  renderData();

  // Initialize prayer schedule if elements exist (i.e., on program.html)
  if (prayerCitySelect) {
    populatePrayerCities();
    fetchAndDisplayPrayerTimes(localStorage.getItem('selectedPrayerCity') || DEFAULT_PRAYER_CITY);
  }
}

init();
})();