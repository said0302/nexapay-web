import React, { useState, useRef, useEffect } from "react";
import {
  ScanLine,
  Home,
  PieChart,
  History,
  ChevronRight,
  Bell,
  Sparkles,
  X,
  Camera,
  Image as ImageIcon,
  Pencil,
  Check,
  Wallet,
  ArrowDownCircle,
  Plus,
  User,
  Settings as SettingsIcon,
  LogOut,
  Trash2,
  Tags,
  CalendarDays,
  TrendingUp,
  Database,
} from "lucide-react";
import { GoogleGenerativeAI } from "@google/generative-ai";

// --- IMPORT FIREBASE ---
import {
  collection,
  onSnapshot,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "./firebase";

// --- KOMPONEN GRAFIK GARIS (LINE/AREA CHART) SUPER ELEGAN ---
const LineChart = ({ data, color = "#3B82F6" }) => {
  if (!data || data.length === 0) return null;

  const maxVal = Math.max(...data.map((d) => d.val), 1);
  const height = 100;
  const width = 300;
  const paddingY = 15;
  const chartHeight = height - paddingY * 2;

  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - paddingY - (d.val / maxVal) * chartHeight;
    return {
      x,
      y,
      val: d.val,
      label: d.label,
      percentX: (i / (data.length - 1)) * 100,
      percentY: (y / height) * 100,
    };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x},${p.y}`)
    .join(" ");
  const areaPath = `${linePath} L ${width},${height} L 0,${height} Z`;

  return (
    <div className="relative w-full h-32 sm:h-44 mt-4 mb-8">
      {/* Gambar SVG Area Gunung */}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="absolute inset-0 w-full h-full overflow-visible"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient
            id={`grad-${color.replace("#", "")}`}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0%" stopColor={color} stopOpacity={0.4} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path
          d={areaPath}
          fill={`url(#grad-${color.replace("#", "")})`}
          className="transition-all duration-700 ease-in-out"
        />
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="drop-shadow-md transition-all duration-700 ease-in-out"
        />
      </svg>

      {/* Titik Point Interaktif */}
      {points.map((p, i) => (
        <div
          key={i}
          className="absolute w-6 h-6 -ml-3 -mt-3 group cursor-pointer flex items-center justify-center z-10"
          style={{ left: `${p.percentX}%`, top: `${p.percentY}%` }}
        >
          <div
            className="w-2.5 h-2.5 bg-white border-[2.5px] border-solid rounded-full transition-transform group-hover:scale-150 shadow-sm"
            style={{ borderColor: color }}
          ></div>
          {/* Tooltip Hover/Klik */}
          <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-1 bg-gray-900 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg transition-opacity whitespace-nowrap pointer-events-none">
            Rp {(p.val / 1000).toLocaleString("id-ID")}K
          </div>
        </div>
      ))}

      {/* Label X-Axis (Hari/Bulan/Tahun) */}
      {points.map((p, i) => (
        <div
          key={`label-${i}`}
          className="absolute top-full mt-2 text-[9px] sm:text-[10px] font-bold text-gray-400 transform -translate-x-1/2 whitespace-nowrap"
          style={{ left: `${p.percentX}%` }}
        >
          {p.label}
        </div>
      ))}
    </div>
  );
};

function App() {
  const [activeMenu, setActiveMenu] = useState("home");
  const [chartFilter, setChartFilter] = useState("Mingguan");

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());

  const [showActionSheet, setShowActionSheet] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(null);

  const defaultCategories = [
    "Makanan & Minuman",
    "Kebutuhan Rumah",
    "Transportasi",
    "Elektronik & Sparepart",
    "Pakaian & Kosmetik",
    "Kesehatan",
    "Hiburan",
    "Lainnya",
  ];
  const pieColors = [
    "#3B82F6",
    "#8B5CF6",
    "#EC4899",
    "#F43F5E",
    "#F59E0B",
    "#10B981",
    "#14B8A6",
    "#06B6D4",
    "#64748B",
    "#94A3B8",
  ];
  const monthNames = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];

  const [categories, setCategories] = useState(() => {
    const savedCats = localStorage.getItem("nexapay_categories");
    return savedCats ? JSON.parse(savedCats) : defaultCategories;
  });

  const [newCategoryName, setNewCategoryName] = useState("");

  useEffect(() => {
    localStorage.setItem("nexapay_categories", JSON.stringify(categories));
  }, [categories]);

  const [manualData, setManualData] = useState({
    type: "expense",
    amount: "",
    store: "",
    category: categories[0],
  });

  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    const q = query(
      collection(db, "transactions"),
      orderBy("timestamp", "desc"),
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const txData = snapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
      }));
      setTransactions(txData);
    });
    return () => unsubscribe();
  }, []);

  const getValidDate = (tx) => {
    return tx.timestamp
      ? new Date(tx.timestamp)
      : new Date(tx.date.replace(",", ""));
  };

  const availableYears = Array.from(
    new Set([
      new Date().getFullYear(),
      ...transactions.map((t) => {
        const d = getValidDate(t);
        return isNaN(d) ? new Date().getFullYear() : d.getFullYear();
      }),
    ]),
  ).sort((a, b) => b - a);

  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  const totalIncome = transactions
    .filter((t) => t.amount > 0)
    .reduce((acc, curr) => acc + curr.amount, 0);
  const totalExpense = transactions
    .filter((t) => t.amount < 0)
    .reduce((acc, curr) => acc + Math.abs(curr.amount), 0);
  const currentBalance = totalIncome - totalExpense;

  const now = new Date();
  const currentDayOfMonth = now.getDate();
  const currentMonthNumber = now.getMonth() + 1;
  const expenseTransactions = transactions.filter((t) => t.type === "expense");

  const getHomeChartData = () => {
    let data = [];
    let avg = 0;
    let labelAvg = "";

    if (homeChartFilter === "Mingguan") {
      data = [
        { label: "Sen", val: 0 },
        { label: "Sel", val: 0 },
        { label: "Rab", val: 0 },
        { label: "Kam", val: 0 },
        { label: "Jum", val: 0 },
        { label: "Sab", val: 0 },
        { label: "Min", val: 0 },
      ];
      let total = 0;
      expenseTransactions.forEach((tx) => {
        const txDate = getValidDate(tx);
        const diffTime = Math.abs(now - txDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays <= 7 && !isNaN(txDate)) {
          let dayIdx = txDate.getDay() - 1;
          if (dayIdx === -1) dayIdx = 6;
          data[dayIdx].val += Math.abs(tx.amount);
          total += Math.abs(tx.amount);
        }
      });
      avg = total / 7;
      labelAvg = "/hari";
    } else if (homeChartFilter === "Bulanan") {
      data = [
        { label: "Mg1", val: 0 },
        { label: "Mg2", val: 0 },
        { label: "Mg3", val: 0 },
        { label: "Mg4", val: 0 },
      ];
      let total = 0;
      expenseTransactions.forEach((tx) => {
        const txDate = getValidDate(tx);
        if (
          !isNaN(txDate) &&
          txDate.getFullYear() === now.getFullYear() &&
          txDate.getMonth() === now.getMonth()
        ) {
          const weekIndex = Math.min(Math.floor((txDate.getDate() - 1) / 7), 3);
          data[weekIndex].val += Math.abs(tx.amount);
          total += Math.abs(tx.amount);
        }
      });
      avg = total / currentDayOfMonth;
      labelAvg = "/hari";
    } else {
      data = [
        { label: "Jan", val: 0 },
        { label: "Feb", val: 0 },
        { label: "Mar", val: 0 },
        { label: "Apr", val: 0 },
        { label: "Mei", val: 0 },
        { label: "Jun", val: 0 },
        { label: "Jul", val: 0 },
        { label: "Ags", val: 0 },
        { label: "Sep", val: 0 },
        { label: "Okt", val: 0 },
        { label: "Nov", val: 0 },
        { label: "Des", val: 0 },
      ];
      let total = 0;
      expenseTransactions.forEach((tx) => {
        const txDate = getValidDate(tx);
        if (!isNaN(txDate) && txDate.getFullYear() === now.getFullYear()) {
          data[txDate.getMonth()].val += Math.abs(tx.amount);
          total += Math.abs(tx.amount);
        }
      });
      avg = total / currentMonthNumber;
      labelAvg = "/bulan";
    }
    return { data, avg, labelAvg };
  };

  const [homeChartFilter, setHomeChartFilter] = useState("Mingguan");
  const {
    data: homeChartData,
    avg: homeAverage,
    labelAvg: homeLabelAvg,
  } = getHomeChartData();

  const filteredExpenseTransactions = transactions.filter((t) => {
    if (t.type !== "expense") return false;
    const txDate = getValidDate(t);
    if (isNaN(txDate)) return false;

    if (chartFilter === "Mingguan") {
      const diffTime = Math.abs(now - txDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 7;
    } else if (chartFilter === "Bulanan") {
      return (
        txDate.getFullYear() === selectedYear &&
        txDate.getMonth() === selectedMonth
      );
    } else if (chartFilter === "Tahunan") {
      return txDate.getFullYear() === selectedYear;
    } else if (chartFilter === "Semua") {
      return true;
    }
    return false;
  });

  const filteredTotalExpense = filteredExpenseTransactions.reduce(
    (acc, curr) => acc + Math.abs(curr.amount),
    0,
  );

  const categoryData = {};
  filteredExpenseTransactions.forEach((tx) => {
    if (tx.items && tx.items.length > 0) {
      tx.items.forEach((item) => {
        let cat = item.category || "Lainnya";
        if (!categories.includes(cat)) cat = "Lainnya";
        const itemTotal = (Number(item.qty) || 1) * (Number(item.price) || 0);
        categoryData[cat] = (categoryData[cat] || 0) + itemTotal;
      });
    } else {
      let cat = tx.category || "Lainnya";
      if (!categories.includes(cat)) cat = "Lainnya";
      categoryData[cat] = (categoryData[cat] || 0) + Math.abs(tx.amount);
    }
  });

  const totalItemExpense = Object.values(categoryData).reduce(
    (a, b) => a + b,
    0,
  );
  const categoryList = Object.keys(categoryData)
    .map((key, index) => ({
      name: key,
      amount: categoryData[key],
      percentage: ((categoryData[key] / (totalItemExpense || 1)) * 100).toFixed(
        0,
      ),
    }))
    .sort((a, b) => b.amount - a.amount)
    .map((cat, index) => ({
      ...cat,
      color: pieColors[index % pieColors.length],
    }));

  let cumulativePercent = 0;
  const pieGradientStops = categoryList
    .map((cat) => {
      const start = cumulativePercent;
      const end = cumulativePercent + parseFloat(cat.percentage);
      cumulativePercent = end;
      return `${cat.color} ${start}% ${end}%`;
    })
    .join(", ");
  const pieStyle =
    categoryList.length > 0
      ? { background: `conic-gradient(${pieGradientStops})` }
      : { background: "#E2E8F0" };

  const generateAnalysisChartData = () => {
    let weekly = [
      { label: "Min", val: 0 },
      { label: "Sen", val: 0 },
      { label: "Sel", val: 0 },
      { label: "Rab", val: 0 },
      { label: "Kam", val: 0 },
      { label: "Jum", val: 0 },
      { label: "Sab", val: 0 },
    ];
    let monthly = [
      { label: "Mg 1", val: 0 },
      { label: "Mg 2", val: 0 },
      { label: "Mg 3", val: 0 },
      { label: "Mg 4", val: 0 },
    ];
    let yearly = [
      { label: "Jan", val: 0 },
      { label: "Feb", val: 0 },
      { label: "Mar", val: 0 },
      { label: "Apr", val: 0 },
      { label: "Mei", val: 0 },
      { label: "Jun", val: 0 },
      { label: "Jul", val: 0 },
      { label: "Ags", val: 0 },
      { label: "Sep", val: 0 },
      { label: "Okt", val: 0 },
      { label: "Nov", val: 0 },
      { label: "Des", val: 0 },
    ];
    let allTime = {};

    filteredExpenseTransactions.forEach((tx) => {
      const txDate = getValidDate(tx);
      const amt = Math.abs(tx.amount);
      if (chartFilter === "Mingguan") {
        weekly[txDate.getDay()].val += amt;
      } else if (chartFilter === "Bulanan") {
        const dayOfMonth = txDate.getDate();
        const weekIndex = Math.min(Math.floor((dayOfMonth - 1) / 7), 3);
        monthly[weekIndex].val += amt;
      } else if (chartFilter === "Tahunan") {
        yearly[txDate.getMonth()].val += amt;
      } else if (chartFilter === "Semua") {
        const year = txDate.getFullYear().toString();
        allTime[year] = (allTime[year] || 0) + amt;
      }
    });

    if (chartFilter === "Mingguan")
      return [
        weekly[1],
        weekly[2],
        weekly[3],
        weekly[4],
        weekly[5],
        weekly[6],
        weekly[0],
      ];
    if (chartFilter === "Bulanan") return monthly;
    if (chartFilter === "Tahunan") return yearly;

    if (chartFilter === "Semua") {
      const sortedYears = Object.keys(allTime).sort(
        (a, b) => Number(a) - Number(b),
      );
      let allTimeArr = sortedYears.map((y) => ({ label: y, val: allTime[y] }));

      // Jika data hanya 1 tahun, kita gandakan titiknya agar grafik garis tidak error (karena garis butuh minimal 2 titik)
      if (allTimeArr.length === 0)
        allTimeArr = [{ label: new Date().getFullYear().toString(), val: 0 }];
      if (allTimeArr.length === 1) {
        allTimeArr = [
          { label: (Number(allTimeArr[0].label) - 1).toString(), val: 0 },
          ...allTimeArr,
        ];
      }
      return allTimeArr;
    }
  };

  const currentAnalysisChartView = generateAnalysisChartData();

  const handleImageSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      setImagePreview(URL.createObjectURL(file));
      setShowActionSheet(false);
    }
  };

  const handleProcessAI = async () => {
    if (!selectedFile) return;
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      alert("API Key Gemini belum dipasang di .env");
      return;
    }

    setIsProcessing(true);
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const reader = new FileReader();
      reader.readAsDataURL(selectedFile);

      reader.onloadend = async () => {
        try {
          const base64Data = reader.result.split(",")[1];
          const allowedCats = categories.join(", ");
          const prompt = `Kamu adalah sistem akuntansi. Baca struk ini, kembalikan HANYA JSON persis ini:
          {
            "store": "Nama Toko", 
            "date": "Tanggal struk (format: DD MMM YYYY, HH:mm)", 
            "amount": -15000, 
            "category": "Tebak kategori toko", 
            "items": [
              { 
                "name": "Nama Barang", 
                "qty": 1, 
                "price": 15000, 
                "category": "WAJIB PILIH DARI: ${allowedCats}. Pilih paling cocok. Jika tidak ada, tulis 'Lainnya'" 
              }
            ]
          }`;

          const result = await model.generateContent([
            prompt,
            { inlineData: { data: base64Data, mimeType: selectedFile.type } },
          ]);
          let responseText = result.response
            .text()
            .replace(/```json/g, "")
            .replace(/```/g, "")
            .trim();
          const extractedData = JSON.parse(responseText);

          const newTransaction = {
            timestamp: Date.now(),
            type: "expense",
            store: extractedData.store || "Toko",
            date: extractedData.date || "Baru Saja",
            amount: Number(extractedData.amount) || 0,
            category: "Lainnya",
            icon: "✨",
            items: (extractedData.items || []).map((item) => ({
              ...item,
              category: categories.includes(item.category)
                ? item.category
                : "Lainnya",
            })),
          };

          await addDoc(collection(db, "transactions"), newTransaction);

          setImagePreview(null);
          setSelectedFile(null);
          setIsProcessing(false);
        } catch (e) {
          alert("Gagal membaca struk.");
          setIsProcessing(false);
        }
      };
    } catch (e) {
      alert("Gagal terhubung ke AI.");
      setIsProcessing(false);
    }
  };

  const handleSaveManual = async () => {
    if (!manualData.amount || !manualData.store)
      return alert("Isi nominal dan nama/keterangan!");
    const nominal =
      manualData.type === "expense"
        ? -Math.abs(Number(manualData.amount))
        : Math.abs(Number(manualData.amount));
    const formattedDate = new Date()
      .toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
      .replace(/\./g, ":");

    const newTransaction = {
      timestamp: Date.now(),
      type: manualData.type,
      store: manualData.type === "income" ? "Pemasukan" : "Pengeluaran Manual",
      date: formattedDate,
      amount: nominal,
      category: "Lainnya",
      icon: manualData.type === "income" ? "💵" : "✍️",
      items: [
        {
          name: manualData.store,
          qty: 1,
          price: Math.abs(nominal),
          category: manualData.category,
        },
      ],
    };

    await addDoc(collection(db, "transactions"), newTransaction);
    setShowManualInput(false);
    setManualData({
      type: "expense",
      amount: "",
      store: "",
      category: categories[0],
    });
  };

  const handleInjectDummyData = async () => {
    if (
      !window.confirm(
        "Yakin ingin menyuntikkan 15 data uji coba ke Database Firebase?",
      )
    )
      return;
    setIsProcessing(true);

    const makeDate = (y, m, d) => {
      const dt = new Date(y, m - 1, d, 10, 30);
      return {
        timestamp: dt.getTime(),
        date: dt
          .toLocaleDateString("id-ID", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
          .replace(/\./g, ":"),
      };
    };

    const dummies = [
      {
        ...makeDate(2026, 2, 20),
        type: "income",
        store: "Gaji Bulan Ini",
        amount: 8000000,
        icon: "💰",
        cat: "Lainnya",
        item: "Gaji Utama",
      },
      {
        ...makeDate(2026, 2, 19),
        type: "expense",
        store: "SPBU Shell",
        amount: -150000,
        icon: "⛽",
        cat: "Transportasi",
        item: "Bensin V-Power",
      },
      {
        ...makeDate(2026, 2, 18),
        type: "expense",
        store: "KFC Sudirman",
        amount: -85000,
        icon: "🍔",
        cat: "Makanan & Minuman",
        item: "Super Besar 2",
      },
      {
        ...makeDate(2026, 2, 15),
        type: "expense",
        store: "Indomaret",
        amount: -60000,
        icon: "🛒",
        cat: "Kebutuhan Rumah",
        item: "Sabun Mandi & Odol",
      },
      {
        ...makeDate(2026, 2, 10),
        type: "expense",
        store: "Apotek Sehat",
        amount: -120000,
        icon: "💊",
        cat: "Kesehatan",
        item: "Vitamin & Obat Flu",
      },
      {
        ...makeDate(2026, 1, 25),
        type: "expense",
        store: "Shopee",
        amount: -350000,
        icon: "👕",
        cat: "Pakaian & Kosmetik",
        item: "Kemeja Polos",
      },
      {
        ...makeDate(2026, 1, 15),
        type: "expense",
        store: "PLN Mobile",
        amount: -200000,
        icon: "💡",
        cat: "Kebutuhan Rumah",
        item: "Token Listrik",
      },
      {
        ...makeDate(2026, 1, 5),
        type: "expense",
        store: "CGV Cinemas",
        amount: -100000,
        icon: "🎟️",
        cat: "Hiburan",
        item: "Tiket Bioskop",
      },
      {
        ...makeDate(2026, 1, 1),
        type: "income",
        store: "Gaji Bulan Lalu",
        amount: 8000000,
        icon: "💰",
        cat: "Lainnya",
        item: "Gaji Utama",
      },
      {
        ...makeDate(2025, 12, 20),
        type: "expense",
        store: "Steam Games",
        amount: -150000,
        icon: "🎮",
        cat: "Hiburan",
        item: "Game PC",
      },
      {
        ...makeDate(2025, 11, 11),
        type: "expense",
        store: "Tokopedia",
        amount: -850000,
        icon: "💻",
        cat: "Elektronik & Sparepart",
        item: "Keyboard Mechanical",
      },
      {
        ...makeDate(2025, 10, 5),
        type: "expense",
        store: "Bengkel Honda",
        amount: -250000,
        icon: "🔧",
        cat: "Transportasi",
        item: "Ganti Oli & Servis Rutin",
      },
    ];

    try {
      for (let data of dummies) {
        const payload = {
          timestamp: data.timestamp,
          type: data.type,
          store: data.store,
          date: data.date,
          amount: data.amount,
          category: "Lainnya",
          icon: data.icon,
          items: [
            {
              name: data.item,
              qty: 1,
              price: Math.abs(data.amount),
              category: data.cat,
            },
          ],
        };
        await addDoc(collection(db, "transactions"), payload);
      }
      alert("Suntik Data Sukses! Cek Grafik Analisis kamu sekarang.");
    } catch (e) {
      alert("Gagal menyuntikkan data.");
    }
    setIsProcessing(false);
  };

  const handleAddCategory = () => {
    if (newCategoryName.trim() === "") return;
    if (categories.includes(newCategoryName.trim()))
      return alert("Kategori sudah ada!");
    setCategories([...categories, newCategoryName.trim()]);
    setNewCategoryName("");
  };

  const handleDeleteCategory = (catToDelete) => {
    if (catToDelete === "Lainnya")
      return alert("Kategori 'Lainnya' tidak bisa dihapus.");
    if (
      window.confirm(
        `Hapus kategori "${catToDelete}"?\n(Semua barang terkait akan otomatis dipindah ke 'Lainnya')`,
      )
    ) {
      setCategories(categories.filter((cat) => cat !== catToDelete));
      transactions.forEach(async (tx) => {
        let needsUpdate = false;
        let updatedItems = tx.items?.map((item) => {
          if (item.category === catToDelete) {
            needsUpdate = true;
            return { ...item, category: "Lainnya" };
          }
          return item;
        });
        if (needsUpdate) {
          const txRef = doc(db, "transactions", tx.id);
          await updateDoc(txRef, { items: updatedItems });
        }
      });
    }
  };

  const startEditing = () => {
    setEditData(JSON.parse(JSON.stringify(selectedTransaction)));
    setIsEditing(true);
  };

  const handleItemChange = (index, field, value) => {
    const updatedItems = [...editData.items];
    updatedItems[index][field] = value;
    const newTotal = updatedItems.reduce(
      (sum, item) => sum + (Number(item.qty) || 1) * (Number(item.price) || 0),
      0,
    );
    setEditData({
      ...editData,
      items: updatedItems,
      amount:
        editData.type === "income" ? Math.abs(newTotal) : -Math.abs(newTotal),
    });
  };

  const handleDeleteItem = (index) => {
    const updatedItems = editData.items.filter((_, i) => i !== index);
    const newTotal = updatedItems.reduce(
      (sum, item) => sum + (Number(item.qty) || 1) * (Number(item.price) || 0),
      0,
    );
    setEditData({
      ...editData,
      items: updatedItems,
      amount:
        editData.type === "income" ? Math.abs(newTotal) : -Math.abs(newTotal),
    });
  };

  const saveEdit = async () => {
    const txRef = doc(db, "transactions", editData.id);
    await updateDoc(txRef, editData);
    setSelectedTransaction(editData);
    setIsEditing(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Yakin ingin menghapus seluruh transaksi ini?")) {
      await deleteDoc(doc(db, "transactions", id));
      setSelectedTransaction(null);
    }
  };

  const handleResetData = () => {
    if (
      window.confirm(
        "PERINGATAN! Yakin ingin menghapus SEMUA riwayat transaksi dari Database Server?",
      )
    ) {
      transactions.forEach(async (tx) => {
        await deleteDoc(doc(db, "transactions", tx.id));
      });
      alert("Proses penghapusan database selesai!");
    }
  };

  const closePopup = () => {
    setSelectedTransaction(null);
    setIsEditing(false);
  };

  const TransactionCard = ({ tx }) => (
    <div
      onClick={() => setSelectedTransaction(tx)}
      className="group flex flex-col p-4 bg-white/80 backdrop-blur-md border border-white/60 rounded-[1.2rem] hover:bg-white cursor-pointer transition-all shadow-sm mb-3"
    >
      <div className="flex justify-between items-center pb-2 border-b border-gray-200/60 mb-3 gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0 pr-2">
          <div
            className={`w-6 h-6 shrink-0 rounded-md flex items-center justify-center text-[12px] ${tx.type === "income" ? "bg-green-100" : "bg-gray-200"}`}
          >
            {tx.icon}
          </div>
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider truncate">
            {tx.store}
          </span>
        </div>
        <span className="text-[10px] shrink-0 font-medium text-gray-400 whitespace-nowrap">
          {tx.date}
        </span>
      </div>
      <div className="flex justify-between items-start gap-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-gray-900 text-sm leading-snug truncate">
            {tx.items && tx.items.length > 0
              ? tx.items[0].name
              : tx.type === "income"
                ? "Pemasukan Dana"
                : "Pengeluaran"}
          </h4>
          {tx.items && tx.items.length > 1 && (
            <p className="text-[10px] font-bold text-blue-500 mt-1 bg-blue-50 inline-block px-1.5 py-0.5 rounded">
              + {tx.items.length - 1} produk lainnya
            </p>
          )}
        </div>
        <div className="text-right shrink-0 whitespace-nowrap pl-2">
          <span
            className={`font-black text-sm md:text-base block ${tx.type === "income" ? "text-green-600" : "text-gray-900"}`}
          >
            {tx.type === "income" ? "+" : "-"}Rp{" "}
            {Math.abs(tx.amount).toLocaleString("id-ID")}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F2F2F7] md:bg-gray-100 p-0 md:p-8 flex justify-center items-center font-sans relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-400/30 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-purple-400/20 rounded-full blur-[100px] pointer-events-none"></div>

      <input
        type="file"
        accept="image/*"
        capture="environment"
        ref={cameraInputRef}
        onChange={handleImageSelect}
        className="hidden"
      />
      <input
        type="file"
        accept="image/*"
        ref={galleryInputRef}
        onChange={handleImageSelect}
        className="hidden"
      />

      <div className="w-full h-screen md:h-[90vh] md:max-w-6xl md:bg-white/40 md:backdrop-blur-3xl md:border md:border-white/60 md:rounded-[3rem] md:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.15)] flex flex-col md:flex-row overflow-hidden relative transition-all duration-500 z-10">
        <aside className="hidden md:flex flex-col w-72 bg-white/30 border-r border-white/50 p-8 z-10 backdrop-blur-xl">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
              <ScanLine size={24} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              NexaPay.
            </h1>
          </div>
          <nav className="flex-1 space-y-3">
            {[
              { id: "home", icon: Home, label: "Beranda" },
              { id: "chart", icon: PieChart, label: "Analisis" },
              { id: "history", icon: History, label: "Riwayat" },
              { id: "settings", icon: SettingsIcon, label: "Pengaturan" },
            ].map((menu) => (
              <button
                key={menu.id}
                onClick={() => setActiveMenu(menu.id)}
                className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all duration-300 ${activeMenu === menu.id ? "bg-white/80 text-blue-600 shadow-sm border border-white/50" : "text-gray-500 hover:bg-white/50 hover:text-gray-900"}`}
              >
                <menu.icon
                  size={22}
                  strokeWidth={activeMenu === menu.id ? 2.5 : 2}
                />
                <span className="font-semibold text-sm">{menu.label}</span>
              </button>
            ))}
          </nav>
          <button
            onClick={() => setShowActionSheet(true)}
            className="mt-auto w-full bg-gray-900 text-white p-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg hover:bg-gray-800 transition-colors"
          >
            <Plus size={20} />{" "}
            <span className="font-bold">Tambah Transaksi</span>
          </button>
        </aside>

        <main className="flex-1 flex flex-col h-full relative overflow-hidden bg-transparent md:bg-white/10">
          <header className="px-6 md:px-10 pt-14 md:pt-10 pb-4 flex justify-between items-center z-10">
            <div>
              <p className="text-gray-500 text-sm font-medium mb-0.5 md:hidden">
                Halo, Selamat Pagi
              </p>
              <h2 className="text-3xl font-bold text-gray-900 tracking-tight">
                {activeMenu === "home"
                  ? "Beranda"
                  : activeMenu === "chart"
                    ? "Analisis"
                    : activeMenu === "settings"
                      ? "Pengaturan"
                      : "Riwayat Belanja"}
              </h2>
            </div>
            <button className="w-11 h-11 rounded-full bg-white/60 border border-white/60 backdrop-blur-xl flex items-center justify-center text-gray-700 shadow-sm hover:bg-white transition-colors">
              <Bell size={20} />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-6 md:px-10 pb-32 md:pb-10 no-scrollbar z-10">
            {activeMenu === "home" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 animate-in fade-in duration-500">
                <div className="flex flex-col gap-4 md:gap-6">
                  <div className="relative p-6 md:p-8 rounded-[1.5rem] border border-white/40 bg-white/40 backdrop-blur-2xl shadow-lg overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/90 to-indigo-600/90 mix-blend-multiply"></div>
                    <div className="relative z-10 text-white flex flex-col justify-center">
                      <div className="flex items-center gap-2 mb-2 opacity-90">
                        <Wallet size={18} />
                        <p className="text-xs md:text-sm font-bold uppercase tracking-wider">
                          Sisa Saldo
                        </p>
                      </div>
                      <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tighter drop-shadow-md truncate">
                        Rp {currentBalance.toLocaleString("id-ID")}
                      </h2>
                    </div>
                  </div>

                  <div className="relative p-6 md:p-8 rounded-[1.5rem] border border-white/40 bg-white/40 backdrop-blur-2xl shadow-lg overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-rose-500/90 to-red-600/90 mix-blend-multiply"></div>
                    <div className="relative z-10 text-white flex flex-col justify-center">
                      <div className="flex items-center gap-2 mb-2 opacity-90">
                        <ArrowDownCircle size={18} />
                        <p className="text-xs md:text-sm font-bold uppercase tracking-wider">
                          Total Pengeluaran
                        </p>
                      </div>
                      <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tighter drop-shadow-md truncate">
                        Rp {totalExpense.toLocaleString("id-ID")}
                      </h2>
                    </div>
                  </div>

                  {/* MINI LINE CHART BERANDA */}
                  <div className="bg-white/60 border border-white/60 backdrop-blur-xl rounded-[1.5rem] p-5 shadow-sm mt-1">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-base font-bold text-gray-900">
                        Statistik Pengeluaran
                      </h3>
                      <select
                        value={homeChartFilter}
                        onChange={(e) => setHomeChartFilter(e.target.value)}
                        className="text-xs bg-white border border-gray-200 rounded-lg p-1.5 font-bold text-blue-600 outline-none cursor-pointer"
                      >
                        <option value="Mingguan">Minggu Ini</option>
                        <option value="Bulanan">Bulan Ini</option>
                        <option value="Tahunan">Tahun Ini</option>
                      </select>
                    </div>

                    <div className="mb-2">
                      <p className="text-xs font-semibold text-gray-500 mb-0.5">
                        Rata-rata Pengeluaran
                      </p>
                      <h4 className="text-xl font-extrabold text-gray-900 truncate flex items-end">
                        Rp {Math.round(homeAverage).toLocaleString("id-ID")}
                        <span className="text-xs font-medium text-gray-500 font-normal ml-1 mb-1">
                          {homeLabelAvg}
                        </span>
                      </h4>
                    </div>

                    <LineChart data={homeChartData} color="#3B82F6" />
                  </div>
                </div>

                <div className="bg-white/50 border border-white/60 backdrop-blur-xl rounded-[2.5rem] p-6 shadow-sm">
                  <div className="flex justify-between items-end mb-6">
                    <h3 className="text-xl font-bold text-gray-900 tracking-tight">
                      Terbaru
                    </h3>
                    <button
                      onClick={() => setActiveMenu("history")}
                      className="text-blue-600 text-sm font-bold flex items-center"
                    >
                      Semua <ChevronRight size={16} />
                    </button>
                  </div>
                  <div>
                    {transactions.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">
                        Belum ada data.
                      </p>
                    ) : (
                      transactions
                        .slice(0, 4)
                        .map((tx) => <TransactionCard key={tx.id} tx={tx} />)
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeMenu === "chart" && (
              <div className="animate-in fade-in duration-500 space-y-6">
                <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 backdrop-blur-xl rounded-[2.5rem] p-8 shadow-xl text-white relative overflow-hidden">
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-1 opacity-80">
                      <CalendarDays size={16} />
                      <p className="text-xs md:text-sm font-medium uppercase tracking-wider">
                        {chartFilter === "Mingguan"
                          ? "7 Hari Terakhir"
                          : chartFilter === "Bulanan"
                            ? `${monthNames[selectedMonth]} ${selectedYear}`
                            : chartFilter === "Tahunan"
                              ? `Tahun ${selectedYear}`
                              : "Seluruh Waktu"}
                      </p>
                    </div>
                    <h3 className="text-3xl sm:text-4xl font-extrabold truncate mt-2">
                      Rp {filteredTotalExpense.toLocaleString("id-ID")}
                    </h3>
                  </div>
                </div>

                {/* LINE CHART ANALISIS LENGKAP */}
                <div className="bg-white/70 border border-white/60 backdrop-blur-xl rounded-[2.5rem] p-6 shadow-sm flex flex-col relative pt-8 pb-4">
                  <div className="flex p-1 bg-gray-100/80 rounded-xl mb-4 mx-auto w-full max-w-lg">
                    {["Mingguan", "Bulanan", "Tahunan", "Semua"].map(
                      (filter) => (
                        <button
                          key={filter}
                          onClick={() => setChartFilter(filter)}
                          className={`flex-1 py-2 text-xs md:text-sm font-bold rounded-lg transition-all ${chartFilter === filter ? "bg-white shadow text-purple-600" : "text-gray-500 hover:text-gray-800"}`}
                        >
                          {filter}
                        </button>
                      ),
                    )}
                  </div>

                  {chartFilter !== "Mingguan" && chartFilter !== "Semua" && (
                    <div className="flex justify-center gap-2 mb-2 animate-in fade-in">
                      {chartFilter === "Bulanan" && (
                        <select
                          value={selectedMonth}
                          onChange={(e) =>
                            setSelectedMonth(Number(e.target.value))
                          }
                          className="p-2 px-3 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-700 outline-none shadow-sm cursor-pointer hover:bg-gray-50"
                        >
                          {monthNames.map((m, i) => (
                            <option key={i} value={i}>
                              {m}
                            </option>
                          ))}
                        </select>
                      )}
                      <select
                        value={selectedYear}
                        onChange={(e) =>
                          setSelectedYear(Number(e.target.value))
                        }
                        className="p-2 px-3 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-700 outline-none shadow-sm cursor-pointer hover:bg-gray-50"
                      >
                        {availableYears.map((y) => (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <LineChart data={currentAnalysisChartView} color="#8B5CF6" />
                </div>

                {/* PIE CHART (DONUT) TETAP ADA */}
                <div className="bg-white/70 border border-white/60 backdrop-blur-xl rounded-[2.5rem] p-6 md:p-8 shadow-sm">
                  <h3 className="text-lg font-bold text-gray-900 mb-6 text-center">
                    Distribusi Kategori
                  </h3>

                  {categoryList.length > 0 ? (
                    <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
                      <div
                        className="relative w-48 h-48 sm:w-56 sm:h-56 shrink-0 flex items-center justify-center rounded-full shadow-[0_10px_40px_rgba(0,0,0,0.1)] transition-transform hover:scale-105 duration-500"
                        style={pieStyle}
                      >
                        <div className="w-32 h-32 sm:w-36 sm:h-36 bg-[#F2F2F7] md:bg-white rounded-full flex flex-col items-center justify-center shadow-inner">
                          <p className="text-xs font-bold text-gray-400 uppercase">
                            Total
                          </p>
                          <p className="text-sm sm:text-base font-black text-gray-900 truncate max-w-[80px] sm:max-w-[100px]">
                            Rp {(filteredTotalExpense / 1000).toFixed(0)}K
                          </p>
                        </div>
                      </div>

                      <div className="w-full flex-1 space-y-3">
                        {categoryList.map((cat, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-3 p-2 hover:bg-white/50 rounded-xl transition-colors"
                          >
                            <div
                              className="w-3.5 h-3.5 rounded-full shadow-sm shrink-0"
                              style={{ backgroundColor: cat.color }}
                            ></div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-sm text-gray-800 truncate">
                                {cat.name}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="font-bold text-sm text-gray-900 whitespace-nowrap">
                                Rp {cat.amount.toLocaleString("id-ID")}
                              </p>
                              <p className="text-[10px] font-bold text-gray-400">
                                {cat.percentage}%
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="h-40 flex flex-col items-center justify-center opacity-50">
                      <PieChart size={48} className="text-gray-300 mb-2" />
                      <p className="text-sm font-semibold text-gray-500">
                        Tidak ada pengeluaran di waktu ini
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeMenu === "history" && (
              <div className="animate-in fade-in duration-500">
                {transactions.length === 0 ? (
                  <p className="text-center text-gray-500 py-10">
                    Belum ada riwayat transaksi.
                  </p>
                ) : (
                  transactions.map((tx) => (
                    <TransactionCard key={tx.id} tx={tx} />
                  ))
                )}
              </div>
            )}

            {activeMenu === "settings" && (
              <div className="animate-in fade-in duration-500 space-y-6">
                <div className="bg-white/60 border border-white/60 backdrop-blur-xl rounded-[2.5rem] p-6 shadow-sm flex items-center gap-6">
                  <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center border-4 border-white shadow-sm overflow-hidden shrink-0">
                    <img
                      src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix"
                      alt="User"
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-2xl font-bold text-gray-900 truncate">
                      Admin Nexa
                    </h3>
                    <p className="text-gray-500 truncate">
                      Terhubung ke Firebase 🔥
                    </p>
                  </div>
                </div>

                <div className="bg-white/60 border border-white/60 backdrop-blur-xl rounded-[2rem] p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-purple-100 text-purple-600 rounded-xl">
                      <Tags size={20} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">
                      Kategori Belanja
                    </h3>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-5">
                    {categories.map((cat, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-700 pl-3 pr-1.5 py-1.5 rounded-xl text-sm font-bold shadow-sm"
                      >
                        <span>{cat}</span>
                        {cat !== "Lainnya" && (
                          <button
                            onClick={() => handleDeleteCategory(cat)}
                            className="text-gray-400 hover:text-red-500 p-1 rounded-md hover:bg-red-50 transition-colors"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="Contoh: Bensin"
                      className="flex-1 p-3 bg-white border border-gray-200 rounded-xl font-medium text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-shadow min-w-0"
                    />
                    <button
                      onClick={handleAddCategory}
                      className="bg-blue-600 text-white px-5 rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-sm shrink-0"
                    >
                      Tambah
                    </button>
                  </div>
                </div>

                <div className="bg-white/60 border border-white/60 backdrop-blur-xl rounded-[2rem] p-4 shadow-sm space-y-2">
                  <button className="w-full flex items-center justify-between p-4 hover:bg-white/80 rounded-2xl transition-colors text-left">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
                        <Sparkles size={20} />
                      </div>
                      <span className="font-semibold text-gray-800">
                        Ubah Kunci API Gemini
                      </span>
                    </div>
                    <ChevronRight size={18} className="text-gray-400" />
                  </button>

                  <button
                    onClick={handleInjectDummyData}
                    disabled={isProcessing}
                    className="w-full flex items-center justify-between p-4 hover:bg-green-50 rounded-2xl transition-colors text-left border border-transparent hover:border-green-100 mt-2"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-green-100 text-green-600 rounded-xl">
                        <Database size={20} />
                      </div>
                      <span className="font-semibold text-green-600">
                        {isProcessing
                          ? "Menyuntikkan Data..."
                          : "Suntik Data Uji Coba (Cheat)"}
                      </span>
                    </div>
                  </button>

                  <button
                    onClick={handleResetData}
                    className="w-full flex items-center justify-between p-4 hover:bg-red-50 rounded-2xl transition-colors text-left border border-transparent hover:border-red-100 mt-2"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-red-100 text-red-600 rounded-xl">
                        <LogOut size={20} />
                      </div>
                      <span className="font-semibold text-red-600">
                        Reset Seluruh Database Server
                      </span>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>

        <div className="md:hidden fixed bottom-6 left-6 right-6 z-30">
          <nav className="bg-white/80 backdrop-blur-2xl border border-white/60 rounded-[2rem] shadow-[0_20px_40px_rgba(0,0,0,0.12)] px-4 py-2 relative flex items-center justify-between">
            <div className="flex w-2/5 justify-around">
              <button
                onClick={() => setActiveMenu("home")}
                className={`p-2 transition-colors ${activeMenu === "home" ? "text-blue-600" : "text-gray-400"}`}
              >
                <Home size={24} strokeWidth={activeMenu === "home" ? 2.5 : 2} />
              </button>
              <button
                onClick={() => setActiveMenu("chart")}
                className={`p-2 transition-colors ${activeMenu === "chart" ? "text-blue-600" : "text-gray-400"}`}
              >
                <PieChart
                  size={24}
                  strokeWidth={activeMenu === "chart" ? 2.5 : 2}
                />
              </button>
            </div>
            <div className="relative w-1/5 flex justify-center">
              <button
                onClick={() => setShowActionSheet(true)}
                className="absolute -top-10 w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center shadow-[0_10px_25px_rgba(59,130,246,0.5)] border-4 border-[#F2F2F7] text-white hover:scale-105 active:scale-95 transition-transform"
              >
                <Plus size={32} strokeWidth={2.5} />
              </button>
            </div>
            <div className="flex w-2/5 justify-around">
              <button
                onClick={() => setActiveMenu("history")}
                className={`p-2 transition-colors ${activeMenu === "history" ? "text-blue-600" : "text-gray-400"}`}
              >
                <History
                  size={24}
                  strokeWidth={activeMenu === "history" ? 2.5 : 2}
                />
              </button>
              <button
                onClick={() => setActiveMenu("settings")}
                className={`p-2 transition-colors ${activeMenu === "settings" ? "text-blue-600" : "text-gray-400"}`}
              >
                <SettingsIcon
                  size={24}
                  strokeWidth={activeMenu === "settings" ? 2.5 : 2}
                />
              </button>
            </div>
          </nav>
        </div>

        {/* MODAL 1: PILIHAN TAMBAH TRANSAKSI */}
        {showActionSheet && (
          <div className="absolute inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div
              className="absolute inset-0"
              onClick={() => setShowActionSheet(false)}
            ></div>
            <div className="w-full md:max-w-md bg-white/95 backdrop-blur-2xl md:rounded-[2.5rem] rounded-t-[2.5rem] p-6 pb-12 md:pb-6 shadow-2xl relative animate-in slide-in-from-bottom-10 md:zoom-in-95 duration-300">
              <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6 md:hidden"></div>
              <h3 className="text-xl font-bold text-gray-900 mb-5 text-center">
                Tambah Transaksi
              </h3>
              <div className="space-y-3">
                <button
                  onClick={() => cameraInputRef.current.click()}
                  className="w-full flex items-center gap-4 p-4 bg-gray-50 border border-gray-100 rounded-2xl text-left"
                >
                  <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
                    <Camera size={24} />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-base">
                      Scan Kamera
                    </p>
                    <p className="text-sm text-gray-500">
                      Auto-ekstrak dengan AI
                    </p>
                  </div>
                </button>
                <button
                  onClick={() => galleryInputRef.current.click()}
                  className="w-full flex items-center gap-4 p-4 bg-gray-50 border border-gray-100 rounded-2xl text-left"
                >
                  <div className="p-3 bg-purple-100 text-purple-600 rounded-xl">
                    <ImageIcon size={24} />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-base">
                      Upload Galeri
                    </p>
                    <p className="text-sm text-gray-500">
                      Pilih foto struk dari HP
                    </p>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setShowActionSheet(false);
                    setShowManualInput(true);
                  }}
                  className="w-full flex items-center gap-4 p-4 bg-gray-50 border border-gray-100 rounded-2xl text-left"
                >
                  <div className="p-3 bg-orange-100 text-orange-600 rounded-xl">
                    <Pencil size={24} />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-base">
                      Input Manual
                    </p>
                    <p className="text-sm text-gray-500">
                      Tulis Pemasukan/Pengeluaran
                    </p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 2: INPUT MANUAL */}
        {showManualInput && (
          <div className="absolute inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200 md:p-4">
            <div
              className="absolute inset-0"
              onClick={() => setShowManualInput(false)}
            ></div>
            <div className="w-full md:max-w-md bg-white rounded-t-[2.5rem] md:rounded-[2.5rem] p-6 shadow-2xl relative animate-in slide-in-from-bottom-10 md:zoom-in-95 duration-300">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-gray-900">
                  Catat Manual
                </h3>
                <button
                  onClick={() => setShowManualInput(false)}
                  className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-200"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex p-1.5 bg-gray-100 rounded-xl mb-6">
                <button
                  onClick={() =>
                    setManualData({ ...manualData, type: "expense" })
                  }
                  className={`flex-1 py-2.5 text-base font-bold rounded-lg transition-colors ${manualData.type === "expense" ? "bg-white shadow text-red-600" : "text-gray-500"}`}
                >
                  Pengeluaran
                </button>
                <button
                  onClick={() =>
                    setManualData({ ...manualData, type: "income" })
                  }
                  className={`flex-1 py-2.5 text-base font-bold rounded-lg transition-colors ${manualData.type === "income" ? "bg-white shadow text-green-600" : "text-gray-500"}`}
                >
                  Pemasukan
                </button>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="text-sm font-semibold text-gray-500 ml-1">
                    Nominal (Rp)
                  </label>
                  <input
                    type="number"
                    value={manualData.amount}
                    onChange={(e) =>
                      setManualData({ ...manualData, amount: e.target.value })
                    }
                    placeholder="Contoh: 50000"
                    className="w-full mt-1.5 p-4 bg-gray-50 border border-gray-200 rounded-xl font-bold text-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-500 ml-1">
                    Keterangan Barang/Pemasukan
                  </label>
                  <input
                    type="text"
                    value={manualData.store}
                    onChange={(e) =>
                      setManualData({ ...manualData, store: e.target.value })
                    }
                    placeholder="Contoh: Bensin Motor"
                    className="w-full mt-1.5 p-4 bg-gray-50 border border-gray-200 rounded-xl font-semibold text-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-500 ml-1">
                    Kategori Barang
                  </label>
                  <select
                    value={manualData.category}
                    onChange={(e) =>
                      setManualData({ ...manualData, category: e.target.value })
                    }
                    className="w-full mt-1.5 p-4 bg-gray-50 border border-gray-200 rounded-xl font-semibold text-lg outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                onClick={handleSaveManual}
                className="w-full mt-8 py-4 bg-blue-600 text-white rounded-xl font-bold text-lg shadow-lg shadow-blue-500/30 active:scale-95 transition-transform"
              >
                Simpan Data
              </button>
            </div>
          </div>
        )}

        {/* MODAL 3: PREVIEW FOTO STRUK */}
        {imagePreview && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
            <div className="w-full max-w-sm sm:max-w-md bg-white/90 backdrop-blur-2xl border border-white/60 p-6 rounded-[2.5rem] shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-900">
                  Konfirmasi Struk
                </h3>
                <button
                  onClick={() => setImagePreview(null)}
                  className="w-8 h-8 bg-gray-200/50 rounded-full flex items-center justify-center text-gray-600"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-hidden rounded-[1.5rem] bg-gray-100 border border-gray-200/50 relative mb-6 flex justify-center items-center min-h-[300px]">
                <img
                  src={imagePreview}
                  className="max-w-full max-h-[50vh] object-contain rounded-[1rem]"
                />
              </div>
              <button
                onClick={handleProcessAI}
                className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-bold shadow-lg"
                disabled={isProcessing}
              >
                {isProcessing
                  ? "Menganalisis dengan AI..."
                  : "Ekstrak Data Sekarang"}
              </button>
            </div>
          </div>
        )}

        {/* MODAL 4: DETAIL TRANSAKSI & EDIT */}
        {selectedTransaction && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-3 md:p-8 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
            <div className="absolute inset-0" onClick={closePopup}></div>
            <div className="w-full max-w-[22rem] sm:max-w-sm bg-white/95 backdrop-blur-3xl border border-white/50 rounded-[2rem] p-5 sm:p-6 shadow-2xl relative animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
              <div className="absolute top-5 right-5 flex gap-2">
                {!isEditing && (
                  <button
                    onClick={() => handleDelete(selectedTransaction.id)}
                    className="p-2 bg-red-50 text-red-500 rounded-full hover:bg-red-100"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
                {!isEditing ? (
                  <button
                    onClick={startEditing}
                    className="p-2 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100"
                  >
                    <Pencil size={18} />
                  </button>
                ) : (
                  <button
                    onClick={saveEdit}
                    className="p-2 bg-green-50 text-green-600 rounded-full hover:bg-green-100"
                  >
                    <Check size={18} strokeWidth={3} />
                  </button>
                )}
              </div>

              <div className="text-center mb-4 mt-2 px-8">
                <div
                  className={`w-12 h-12 text-2xl rounded-2xl flex items-center justify-center mx-auto mb-2 ${selectedTransaction.type === "income" ? "bg-green-100" : "bg-gray-100"}`}
                >
                  {isEditing ? editData.icon : selectedTransaction.icon}
                </div>
                {isEditing ? (
                  <input
                    type="text"
                    value={editData.store}
                    onChange={(e) =>
                      setEditData({ ...editData, store: e.target.value })
                    }
                    className="w-full text-center font-bold text-xl bg-gray-50 border border-gray-200 rounded-xl p-1.5 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <>
                    <h3 className="font-bold text-xl text-gray-900 truncate">
                      {selectedTransaction.store}
                    </h3>
                    <p className="text-xs text-gray-400 mt-1">
                      {selectedTransaction.date}
                    </p>
                  </>
                )}
              </div>

              {selectedTransaction.items &&
                selectedTransaction.items.length > 0 && (
                  <>
                    <div className="my-3 border-t-2 border-dashed border-gray-200 shrink-0"></div>
                    <div className="flex-1 overflow-y-auto pr-1 space-y-3 no-scrollbar min-h-0">
                      {isEditing
                        ? editData.items.map((item, index) => (
                            <div
                              key={index}
                              className="bg-white p-3 rounded-2xl space-y-2.5 border border-gray-200 relative pr-9 shadow-sm"
                            >
                              <button
                                onClick={() => handleDeleteItem(index)}
                                className="absolute top-3.5 right-2 p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                                title="Hapus"
                              >
                                <Trash2 size={16} />
                              </button>
                              <input
                                type="text"
                                value={item.name}
                                onChange={(e) =>
                                  handleItemChange(
                                    index,
                                    "name",
                                    e.target.value,
                                  )
                                }
                                className="w-full text-sm font-bold text-gray-800 border border-gray-200 rounded-xl p-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                              />
                              <select
                                value={item.category || categories[7]}
                                onChange={(e) =>
                                  handleItemChange(
                                    index,
                                    "category",
                                    e.target.value,
                                  )
                                }
                                className="w-full text-xs font-semibold text-blue-600 border border-gray-200 rounded-xl p-2 outline-none bg-white focus:border-blue-500"
                              >
                                {categories.map((cat) => (
                                  <option key={cat} value={cat}>
                                    {cat}
                                  </option>
                                ))}
                              </select>
                              <div className="flex gap-2">
                                <div className="relative">
                                  <span className="absolute left-2.5 top-2 text-gray-400 text-xs font-bold">
                                    x
                                  </span>
                                  <input
                                    type="number"
                                    value={item.qty}
                                    onChange={(e) =>
                                      handleItemChange(
                                        index,
                                        "qty",
                                        e.target.value,
                                      )
                                    }
                                    className="w-14 pl-6 pr-1 py-2 text-sm font-semibold border border-gray-200 rounded-xl outline-none text-center min-w-0"
                                  />
                                </div>
                                <div className="relative flex-1 min-w-0">
                                  <span className="absolute left-2.5 top-2 text-gray-400 text-xs font-bold">
                                    Rp
                                  </span>
                                  <input
                                    type="number"
                                    value={item.price}
                                    onChange={(e) =>
                                      handleItemChange(
                                        index,
                                        "price",
                                        e.target.value,
                                      )
                                    }
                                    className="w-full pl-8 pr-2 py-2 text-sm font-semibold border border-gray-200 rounded-xl outline-none"
                                  />
                                </div>
                              </div>
                            </div>
                          ))
                        : selectedTransaction.items?.map((item, index) => (
                            <div
                              key={index}
                              className="flex justify-between items-start gap-2"
                            >
                              <div className="flex-1 min-w-0 pr-2">
                                <p className="font-semibold text-gray-800 text-sm truncate">
                                  {item.name}
                                </p>
                                <div className="mt-1.5">
                                  <span className="text-[9px] bg-gray-200 text-gray-600 font-bold px-2 py-0.5 rounded uppercase">
                                    {item.category || "Lainnya"}
                                  </span>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="font-bold text-gray-900 text-sm whitespace-nowrap">
                                  Rp{" "}
                                  {(
                                    (Number(item.qty) || 1) *
                                    (Number(item.price) || 0)
                                  ).toLocaleString("id-ID")}
                                </p>
                                {Number(item.qty) > 1 && (
                                  <p className="text-[11px] text-gray-500 whitespace-nowrap mt-0.5">
                                    {item.qty} x Rp{" "}
                                    {(Number(item.price) || 0).toLocaleString(
                                      "id-ID",
                                    )}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                    </div>
                  </>
                )}

              <div className="my-4 border-t-2 border-dashed border-gray-200 shrink-0"></div>
              <div className="flex justify-between items-end mt-1 shrink-0 gap-2">
                <span className="text-base font-bold text-gray-900 shrink-0">
                  Total Harga
                </span>
                {isEditing ? (
                  <input
                    type="number"
                    value={Math.abs(editData.amount)}
                    onChange={(e) =>
                      setEditData({
                        ...editData,
                        amount:
                          editData.type === "income"
                            ? Math.abs(e.target.value)
                            : -Math.abs(e.target.value),
                      })
                    }
                    className={`text-lg font-black bg-gray-50 border border-gray-200 rounded-xl p-1.5 w-32 min-w-0 text-right outline-none focus:ring-2 focus:ring-blue-500 ${editData.type === "income" ? "text-green-600" : "text-blue-600"}`}
                  />
                ) : (
                  <span
                    className={`text-2xl font-black shrink-0 whitespace-nowrap ${selectedTransaction.type === "income" ? "text-green-600" : "text-rose-600"}`}
                  >
                    {selectedTransaction.type === "income" ? "+" : "-"}Rp{" "}
                    {Math.abs(selectedTransaction.amount).toLocaleString(
                      "id-ID",
                    )}
                  </span>
                )}
              </div>

              <button
                onClick={isEditing ? () => setIsEditing(false) : closePopup}
                className={`w-full mt-6 py-3 rounded-xl font-bold text-base transition-colors shrink-0 ${isEditing ? "bg-red-50 text-red-600 hover:bg-red-100" : "bg-gray-100 text-gray-800 hover:bg-gray-200"}`}
              >
                {isEditing ? "Batal Edit" : "Tutup Detail"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
