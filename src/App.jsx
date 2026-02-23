import React, { useState, useRef, useEffect } from "react";
import {
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
  Search,
  AlertCircle,
  Info,
} from "lucide-react";
import { GoogleGenerativeAI } from "@google/generative-ai";

// --- IMPORT FRAMER MOTION (ANIMASI) ---
import { motion, AnimatePresence } from "framer-motion";

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
  where,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { db, auth, googleProvider } from "./firebase";

// --- FUNGSI FORMAT TERBILANG (RUPIAH) ---
const formatTerbilang = (num) => {
  if (num === 0) return "Nol Rupiah";
  const isNegative = num < 0;
  const absNum = Math.abs(num);
  let result = "";

  if (absNum >= 1000000000000)
    result =
      parseFloat((absNum / 1000000000000).toFixed(2))
        .toString()
        .replace(".", ",") + " Triliun";
  else if (absNum >= 1000000000)
    result =
      parseFloat((absNum / 1000000000).toFixed(2))
        .toString()
        .replace(".", ",") + " Miliar";
  else if (absNum >= 1000000)
    result =
      parseFloat((absNum / 1000000).toFixed(2))
        .toString()
        .replace(".", ",") + " Juta";
  else if (absNum >= 1000)
    result =
      parseFloat((absNum / 1000).toFixed(1))
        .toString()
        .replace(".", ",") + " Ribu";
  else result = absNum.toString();

  return (isNegative ? "- " : "") + result + " Rupiah";
};

// --- KOMPONEN GRAFIK GARIS (BERANIMASI) ---
const LineChart = ({ data, color = "#3B82F6" }) => {
  if (!data || data.length === 0) return null;
  const maxVal = Math.max(...data.map((d) => d.val), 1);
  const height = 100,
    width = 300,
    paddingY = 15;
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
        <motion.path
          d={areaPath}
          fill={`url(#grad-${color.replace("#", "")})`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
        />
        <motion.path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="drop-shadow-md"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
        />
      </svg>
      {points.map((p, i) => (
        <motion.div
          key={i}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: i * 0.1, type: "spring" }}
          className="absolute w-6 h-6 -ml-3 -mt-3 group cursor-pointer flex items-center justify-center z-10"
          style={{ left: `${p.percentX}%`, top: `${p.percentY}%` }}
        >
          <div
            className="w-2.5 h-2.5 bg-white border-[2.5px] border-solid rounded-full transition-transform group-hover:scale-150 shadow-sm"
            style={{ borderColor: color }}
          ></div>
          <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-1 bg-gray-900 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg transition-opacity whitespace-nowrap pointer-events-none">
            Rp {(p.val / 1000).toLocaleString("id-ID")}K
          </div>
        </motion.div>
      ))}
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
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

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

  // INI YANG SEBELUMNYA HILANG:
  const [showAboutApp, setShowAboutApp] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [historySort, setHistorySort] = useState("newest");

  const [dialog, setDialog] = useState({
    isOpen: false,
    type: "alert",
    title: "",
    message: "",
    onConfirm: null,
  });

  const showAlert = (title, message) =>
    setDialog({ isOpen: true, type: "alert", title, message, onConfirm: null });
  const showConfirm = (title, message, onConfirm) =>
    setDialog({ isOpen: true, type: "confirm", title, message, onConfirm });
  const closeDialog = () =>
    setDialog({
      isOpen: false,
      type: "alert",
      title: "",
      message: "",
      onConfirm: null,
    });

  const defaultCategories = [
    "Makanan & Minuman",
    "Kebutuhan Rumah",
    "Transportasi",
    "Tagihan & Cicilan",
    "Elektronik & Sparepart",
    "Pakaian & Kosmetik",
    "Kesehatan",
    "Pendidikan",
    "Hiburan",
    "Sedekah & Donasi",
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
    "#34D399",
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

  const [categories, setCategories] = useState(defaultCategories);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [manualData, setManualData] = useState({
    type: "expense",
    amount: "",
    store: "",
    category: "Lainnya",
  });
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setIsAuthChecking(false);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    const fetchUserData = async () => {
      if (currentUser) {
        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists())
          setCategories(userSnap.data().categories || defaultCategories);
        else {
          await setDoc(userRef, { categories: defaultCategories });
          setCategories(defaultCategories);
        }
      }
    };
    fetchUserData();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, "transactions"),
      where("userId", "==", currentUser.uid),
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
  }, [currentUser]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      showAlert(
        "Gagal Login",
        "Tidak dapat terhubung dengan Google. " + error.message,
      );
    }
  };

  const handleLogout = () => {
    showConfirm(
      "Keluar Akun",
      "Apakah Anda yakin ingin keluar dari akun ini?",
      async () => {
        await signOut(auth);
        setTransactions([]);
        setCategories(defaultCategories);
      },
    );
  };

  const getValidDate = (tx) =>
    tx.timestamp ? new Date(tx.timestamp) : new Date(tx.date.replace(",", ""));

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
  const expenseTransactions = transactions.filter((t) => t.type === "expense");

  const getHomeChartData = () => {
    let data = [];
    let total = 0;
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
      expenseTransactions.forEach((tx) => {
        const txDate = getValidDate(tx);
        const diffTime = Math.abs(now - txDate);
        if (
          Math.ceil(diffTime / (1000 * 60 * 60 * 24)) <= 7 &&
          !isNaN(txDate)
        ) {
          let dayIdx = txDate.getDay() - 1;
          if (dayIdx === -1) dayIdx = 6;
          data[dayIdx].val += Math.abs(tx.amount);
          total += Math.abs(tx.amount);
        }
      });
    } else if (homeChartFilter === "Bulanan") {
      data = [
        { label: "Mg1", val: 0 },
        { label: "Mg2", val: 0 },
        { label: "Mg3", val: 0 },
        { label: "Mg4", val: 0 },
      ];
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
      expenseTransactions.forEach((tx) => {
        const txDate = getValidDate(tx);
        if (!isNaN(txDate) && txDate.getFullYear() === now.getFullYear()) {
          data[txDate.getMonth()].val += Math.abs(tx.amount);
          total += Math.abs(tx.amount);
        }
      });
    }
    return { data, total };
  };

  const [homeChartFilter, setHomeChartFilter] = useState("Mingguan");
  const { data: homeChartData, total: homeTotal } = getHomeChartData();

  const filteredExpenseTransactions = transactions.filter((t) => {
    if (t.type !== "expense") return false;
    const txDate = getValidDate(t);
    if (isNaN(txDate)) return false;
    if (chartFilter === "Mingguan")
      return Math.ceil(Math.abs(now - txDate) / (1000 * 60 * 60 * 24)) <= 7;
    else if (chartFilter === "Bulanan")
      return (
        txDate.getFullYear() === selectedYear &&
        txDate.getMonth() === selectedMonth
      );
    else if (chartFilter === "Tahunan")
      return txDate.getFullYear() === selectedYear;
    else if (chartFilter === "Semua") return true;
    return false;
  });

  const filteredTotalExpense = filteredExpenseTransactions.reduce(
    (acc, curr) => acc + Math.abs(curr.amount),
    0,
  );

  // LOGIKA KATEGORI CASE-INSENSITIVE (BEBAS HURUF BESAR/KECIL)
  const categoryData = {};
  filteredExpenseTransactions.forEach((tx) => {
    if (tx.items && tx.items.length > 0) {
      tx.items.forEach((item) => {
        const matchedCat = categories.find(
          (c) =>
            c.toLowerCase() ===
            String(item.category || "")
              .trim()
              .toLowerCase(),
        );
        let cat = matchedCat || "Lainnya";
        categoryData[cat] =
          (categoryData[cat] || 0) +
          (Number(item.qty) || 1) * (Number(item.price) || 0);
      });
    } else {
      const matchedCat = categories.find(
        (c) =>
          c.toLowerCase() ===
          String(tx.category || "")
            .trim()
            .toLowerCase(),
      );
      let cat = matchedCat || "Lainnya";
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
      const start = cumulativePercent,
        end = cumulativePercent + parseFloat(cat.percentage);
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
      if (chartFilter === "Mingguan")
        weekly[txDate.getDay()].val += Math.abs(tx.amount);
      else if (chartFilter === "Bulanan")
        monthly[Math.min(Math.floor((txDate.getDate() - 1) / 7), 3)].val +=
          Math.abs(tx.amount);
      else if (chartFilter === "Tahunan")
        yearly[txDate.getMonth()].val += Math.abs(tx.amount);
      else if (chartFilter === "Semua")
        allTime[txDate.getFullYear().toString()] =
          (allTime[txDate.getFullYear().toString()] || 0) + Math.abs(tx.amount);
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
      let allTimeArr = Object.keys(allTime)
        .sort((a, b) => Number(a) - Number(b))
        .map((y) => ({ label: y, val: allTime[y] }));
      if (allTimeArr.length === 0)
        allTimeArr = [{ label: new Date().getFullYear().toString(), val: 0 }];
      if (allTimeArr.length === 1)
        allTimeArr = [
          { label: (Number(allTimeArr[0].label) - 1).toString(), val: 0 },
          ...allTimeArr,
        ];
      return allTimeArr;
    }
  };
  const currentAnalysisChartView = generateAnalysisChartData();

  const sortedAndFilteredHistory = transactions
    .filter((tx) => {
      if (!searchQuery) return true;
      const queryStr = searchQuery.toLowerCase();
      if (tx.store.toLowerCase().includes(queryStr)) return true;
      if (tx.category.toLowerCase().includes(queryStr)) return true;
      if (
        tx.items &&
        tx.items.some(
          (item) =>
            item.name.toLowerCase().includes(queryStr) ||
            (item.category && item.category.toLowerCase().includes(queryStr)),
        )
      )
        return true;
      return false;
    })
    .sort((a, b) => {
      if (historySort === "newest") return b.timestamp - a.timestamp;
      if (historySort === "oldest") return a.timestamp - b.timestamp;
      if (historySort === "a-z") return a.store.localeCompare(b.store);
      if (historySort === "z-a") return b.store.localeCompare(a.store);
      return 0;
    });

  const handleImageSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      setImagePreview(URL.createObjectURL(file));
      setShowActionSheet(false);
    }
  };

  const handleProcessAI = async () => {
    if (!selectedFile || !currentUser) return;
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      showAlert(
        "Kunci Belum Diatur",
        "API Key Gemini belum dipasang di sistem.",
      );
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
          const prompt = `Kamu adalah sistem akuntansi. Baca struk ini, kembalikan HANYA JSON persis ini: { "store": "Nama Toko", "date": "DD MMM YYYY, HH:mm", "isoDate": "YYYY-MM-DDTHH:mm:ss", "amount": -15000, "category": "Tebak kategori", "items": [ { "name": "Barang", "qty": 1, "price": 15000, "category": "WAJIB PILIH DARI: ${allowedCats}" } ] }`;

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

          let txTimestamp = Date.now();
          if (extractedData.isoDate)
            txTimestamp =
              new Date(extractedData.isoDate).getTime() || Date.now();

          // PENCOCOKAN KATEGORI AI DENGAN KEBAL HURUF BESAR/KECIL
          let mainCategory = "Lainnya";
          if (extractedData.category) {
            const matchedMainCat = categories.find(
              (c) =>
                c.toLowerCase() ===
                String(extractedData.category).trim().toLowerCase(),
            );
            if (matchedMainCat) mainCategory = matchedMainCat;
          }

          const newTransaction = {
            userId: currentUser.uid,
            timestamp: txTimestamp,
            type: "expense",
            store: extractedData.store || "Toko",
            date: extractedData.date || "Baru Saja",
            amount: Number(extractedData.amount) || 0,
            category: mainCategory,
            icon: "✨",
            items: (extractedData.items || []).map((item) => {
              const matchedCat = categories.find(
                (c) =>
                  c.toLowerCase() ===
                  String(item.category || "")
                    .trim()
                    .toLowerCase(),
              );
              return {
                ...item,
                category: matchedCat || "Lainnya",
              };
            }),
          };

          const docRef = await addDoc(
            collection(db, "transactions"),
            newTransaction,
          );
          setSelectedTransaction({ ...newTransaction, id: docRef.id });
          setIsEditing(false);
          setImagePreview(null);
          setSelectedFile(null);
          setIsProcessing(false);
        } catch (e) {
          showAlert(
            "Gagal Ekstrak",
            "AI tidak dapat membaca data dari gambar struk ini.",
          );
          setIsProcessing(false);
        }
      };
    } catch (e) {
      showAlert(
        "Gagal Terhubung",
        "Tidak dapat terhubung ke AI. Cek koneksi atau Kunci API.",
      );
      setIsProcessing(false);
    }
  };

  const handleSaveManual = async () => {
    if (!manualData.amount || !manualData.store || !currentUser)
      return showAlert(
        "Peringatan",
        "Isi nominal dan keterangan dengan lengkap!",
      );
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

    await addDoc(collection(db, "transactions"), {
      userId: currentUser.uid,
      timestamp: Date.now(),
      type: manualData.type,
      store: manualData.type === "income" ? "Pemasukan" : "Pengeluaran Manual",
      date: formattedDate,
      amount: nominal,
      category: manualData.category,
      icon: manualData.type === "income" ? "💵" : "✍️",
      items: [
        {
          name: manualData.store,
          qty: 1,
          price: Math.abs(nominal),
          category: manualData.category,
        },
      ],
    });
    setShowManualInput(false);
    setManualData({
      type: "expense",
      amount: "",
      store: "",
      category: categories[0],
    });
  };

  const handleAddCategory = async () => {
    if (newCategoryName.trim() === "") return;
    const exists = categories.find(
      (c) => c.toLowerCase() === newCategoryName.trim().toLowerCase(),
    );
    if (exists)
      return showAlert("Sudah Ada", `Kategori "${exists}" sudah ada!`);
    const updatedCategories = [...categories, newCategoryName.trim()];
    setCategories(updatedCategories);
    setNewCategoryName("");
    if (currentUser)
      await updateDoc(doc(db, "users", currentUser.uid), {
        categories: updatedCategories,
      });
  };

  const handleDeleteCategory = async (catToDelete) => {
    if (catToDelete === "Lainnya")
      return showAlert(
        "Ditolak",
        "Kategori sistem 'Lainnya' tidak dapat dihapus.",
      );
    showConfirm(
      "Hapus Kategori",
      `Hapus kategori "${catToDelete}"? Transaksi lama akan otomatis dialihkan ke 'Lainnya'.`,
      async () => {
        const updatedCategories = categories.filter(
          (cat) => cat !== catToDelete,
        );
        setCategories(updatedCategories);
        if (currentUser)
          await updateDoc(doc(db, "users", currentUser.uid), {
            categories: updatedCategories,
          });
        transactions.forEach(async (tx) => {
          let needsUpdate = false;
          let updatedItems = tx.items?.map((item) => {
            if (item.category === catToDelete) {
              needsUpdate = true;
              return { ...item, category: "Lainnya" };
            }
            return item;
          });
          if (needsUpdate)
            await updateDoc(doc(db, "transactions", tx.id), {
              items: updatedItems,
            });
        });
      },
    );
  };

  const startEditing = () => {
    const dataToEdit = JSON.parse(JSON.stringify(selectedTransaction));
    if (!dataToEdit.timestamp)
      dataToEdit.timestamp = getValidDate(dataToEdit).getTime();
    setEditData(dataToEdit);
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
    await updateDoc(doc(db, "transactions", editData.id), editData);
    setSelectedTransaction(editData);
    setIsEditing(false);
  };
  const handleDelete = (id) => {
    showConfirm(
      "Hapus Transaksi",
      "Data transaksi ini akan dihapus secara permanen. Lanjutkan?",
      async () => {
        await deleteDoc(doc(db, "transactions", id));
        setSelectedTransaction(null);
      },
    );
  };
  const closePopup = () => {
    setSelectedTransaction(null);
    setIsEditing(false);
  };

  const TransactionCard = ({ tx }) => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => setSelectedTransaction(tx)}
      className="group flex flex-col p-4 bg-white/80 backdrop-blur-md border border-white/60 rounded-[1.2rem] hover:bg-white cursor-pointer shadow-sm mb-3 transition-colors"
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
    </motion.div>
  );

  if (isAuthChecking)
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center font-bold text-gray-500">
        Memuat Aplikasi...
      </div>
    );

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#F2F2F7] flex justify-center items-center font-sans p-6 relative">
        <AnimatePresence>
          {dialog.isOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="w-full max-w-xs bg-white/95 backdrop-blur-3xl rounded-[2rem] p-6 shadow-2xl text-center"
              >
                <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle size={24} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {dialog.title}
                </h3>
                <p className="text-sm text-gray-500 mb-6">{dialog.message}</p>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={closeDialog}
                  className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg"
                >
                  Mengerti
                </motion.button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md bg-white p-8 rounded-[2.5rem] shadow-2xl text-center z-10 relative"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.2 }}
            className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl flex items-center justify-center text-white shadow-xl mx-auto mb-6 p-4"
          >
            <img
              src="/logo-192.png"
              alt="Logo NexaPay"
              className="w-full h-full object-contain drop-shadow-sm"
            />
          </motion.div>
          <h1 className="text-3xl font-extrabold text-gray-900 mb-2">
            NexaPay.
          </h1>
          <p className="text-gray-500 mb-10 font-medium text-sm">
            Aplikasi Keuangan Pintar Berbasis AI
          </p>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleLogin}
            className="w-full bg-gray-900 text-white p-4 rounded-2xl flex items-center justify-center gap-3 shadow-lg"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span className="font-bold">Masuk dengan Google</span>
          </motion.button>
        </motion.div>

        {/* --- COPYRIGHT DI HALAMAN LOGIN --- */}
        <div className="absolute bottom-8 w-full text-center z-0">
          <p className="text-xs font-bold text-gray-400 tracking-widest uppercase">
            © 2026 Bale Teknisi
          </p>
        </div>
      </div>
    );
  }

  const tabVariants = {
    hidden: { opacity: 0, x: 20 },
    enter: { opacity: 1, x: 0, transition: { duration: 0.3, ease: "easeOut" } },
    exit: { opacity: 0, x: -20, transition: { duration: 0.2, ease: "easeIn" } },
  };

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

      <AnimatePresence>
        {dialog.isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[100] flex items-center justify-center p-5 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="w-full max-w-[20rem] bg-white/95 backdrop-blur-3xl rounded-[2rem] p-6 shadow-2xl text-center"
            >
              <h3 className="text-xl font-extrabold text-gray-900 mb-2">
                {dialog.title}
              </h3>
              <p className="text-sm font-medium text-gray-500 mb-6 leading-relaxed">
                {dialog.message}
              </p>
              <div className="flex gap-3">
                {dialog.type === "confirm" && (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={closeDialog}
                    className="flex-1 py-3.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200"
                  >
                    Batal
                  </motion.button>
                )}
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    if (dialog.onConfirm) dialog.onConfirm();
                    closeDialog();
                  }}
                  className={`flex-1 py-3.5 text-white font-bold rounded-xl shadow-lg ${dialog.type === "confirm" ? "bg-blue-600" : "bg-gray-900"}`}
                >
                  {dialog.type === "confirm" ? "Oke" : "Mengerti"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="w-full h-screen md:h-[90vh] md:max-w-6xl md:bg-white/40 md:backdrop-blur-3xl md:border md:border-white/60 md:rounded-[3rem] md:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.15)] flex flex-col md:flex-row overflow-hidden relative transition-all duration-500 z-10">
        <aside className="hidden md:flex flex-col w-72 bg-white/30 border-r border-white/50 p-8 z-10 backdrop-blur-xl">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg p-1.5">
              <img
                src="/logo-192.png"
                alt="Logo NexaPay"
                className="w-full h-full object-contain"
              />
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
              <motion.button
                whileTap={{ scale: 0.95 }}
                key={menu.id}
                onClick={() => setActiveMenu(menu.id)}
                className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all duration-300 ${activeMenu === menu.id ? "bg-white/80 text-blue-600 shadow-sm border border-white/50" : "text-gray-500 hover:bg-white/50 hover:text-gray-900"}`}
              >
                <menu.icon
                  size={22}
                  strokeWidth={activeMenu === menu.id ? 2.5 : 2}
                />
                <span className="font-semibold text-sm">{menu.label}</span>
              </motion.button>
            ))}
          </nav>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowActionSheet(true)}
            className="mt-auto w-full bg-gray-900 text-white p-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg hover:bg-gray-800 transition-colors"
          >
            <Plus size={20} />{" "}
            <span className="font-bold">Tambah Transaksi</span>
          </motion.button>
        </aside>

        <main className="flex-1 flex flex-col h-full relative overflow-hidden bg-transparent md:bg-white/10">
          <header className="px-6 md:px-10 pt-6 md:pt-10 pb-4 flex justify-between items-center z-10 shrink-0">
            <div>
              <p className="text-gray-500 text-sm font-medium mb-0.5 md:hidden">
                Halo, {currentUser?.displayName?.split(" ")[0]}
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
            <img
              src={
                currentUser?.photoURL ||
                "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix"
              }
              className="w-11 h-11 rounded-full border-2 border-white shadow-sm"
              alt="Profile"
            />
          </header>

          <div className="flex-1 overflow-y-auto px-6 md:px-10 pb-32 md:pb-10 no-scrollbar z-10 overflow-x-hidden relative">
            <AnimatePresence mode="wait">
              {/* --- KONTEN BERANDA --- */}
              {activeMenu === "home" && (
                <motion.div
                  key="home"
                  variants={tabVariants}
                  initial="hidden"
                  animate="enter"
                  exit="exit"
                  className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8"
                >
                  <div className="flex flex-col gap-4 md:gap-6">
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      className="relative p-6 md:p-8 rounded-[1.5rem] border border-white/40 bg-white/40 backdrop-blur-2xl shadow-lg overflow-hidden group cursor-default"
                    >
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
                        <p className="text-xs sm:text-sm font-semibold opacity-80 mt-1.5 tracking-wide">
                          ~ {formatTerbilang(currentBalance)}
                        </p>
                      </div>
                    </motion.div>
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      className="relative p-6 md:p-8 rounded-[1.5rem] border border-white/40 bg-white/40 backdrop-blur-2xl shadow-lg overflow-hidden group cursor-default"
                    >
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
                        <p className="text-xs sm:text-sm font-semibold opacity-80 mt-1.5 tracking-wide">
                          ~ {formatTerbilang(totalExpense)}
                        </p>
                      </div>
                    </motion.div>
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
                          {homeChartFilter === "Mingguan"
                            ? "Total Minggu Ini"
                            : homeChartFilter === "Bulanan"
                              ? "Total Bulan Ini"
                              : "Total Tahun Ini"}
                        </p>
                        <h4 className="text-xl font-extrabold text-gray-900 truncate flex items-end">
                          Rp {homeTotal.toLocaleString("id-ID")}
                        </h4>
                      </div>
                      <LineChart data={homeChartData} color="#3B82F6" />
                    </div>
                  </div>
                  <div className="bg-white/50 border border-white/60 backdrop-blur-xl rounded-[2.5rem] p-6 shadow-sm flex flex-col">
                    <div className="flex justify-between items-end mb-6 shrink-0">
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
                    <div className="flex-1 overflow-y-auto no-scrollbar">
                      {transactions.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">
                          Belum ada data.
                        </p>
                      ) : (
                        transactions
                          .slice(0, 5)
                          .map((tx) => <TransactionCard key={tx.id} tx={tx} />)
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* --- KONTEN ANALISIS --- */}
              {activeMenu === "chart" && (
                <motion.div
                  key="chart"
                  variants={tabVariants}
                  initial="hidden"
                  animate="enter"
                  exit="exit"
                  className="space-y-6"
                >
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 backdrop-blur-xl rounded-[1.5rem] p-6 md:p-8 shadow-xl text-white relative overflow-hidden cursor-default"
                  >
                    <div className="relative z-10">
                      <div className="flex items-center gap-2 mb-2 opacity-80">
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
                      <h3 className="text-3xl sm:text-4xl font-extrabold truncate">
                        Rp {filteredTotalExpense.toLocaleString("id-ID")}
                      </h3>
                      <p className="text-xs sm:text-sm font-semibold opacity-80 mt-1.5 tracking-wide">
                        ~ {formatTerbilang(filteredTotalExpense)}
                      </p>
                    </div>
                  </motion.div>
                  <div className="bg-white/70 border border-white/60 backdrop-blur-xl rounded-[2.5rem] p-6 shadow-sm flex flex-col relative pt-8 pb-4">
                    <div className="flex p-1 bg-gray-100/80 rounded-xl mb-4 mx-auto w-full max-w-lg">
                      {["Mingguan", "Bulanan", "Tahunan", "Semua"].map(
                        (filter) => (
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            key={filter}
                            onClick={() => setChartFilter(filter)}
                            className={`flex-1 py-2 text-xs md:text-sm font-bold rounded-lg transition-all ${chartFilter === filter ? "bg-white shadow text-purple-600" : "text-gray-500 hover:text-gray-800"}`}
                          >
                            {filter}
                          </motion.button>
                        ),
                      )}
                    </div>
                    {chartFilter !== "Mingguan" && chartFilter !== "Semua" && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex justify-center gap-2 mb-2"
                      >
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
                      </motion.div>
                    )}
                    <LineChart
                      data={currentAnalysisChartView}
                      color="#8B5CF6"
                    />
                  </div>
                  <div className="bg-white/70 border border-white/60 backdrop-blur-xl rounded-[2.5rem] p-6 md:p-8 shadow-sm">
                    <h3 className="text-lg font-bold text-gray-900 mb-6 text-center">
                      Distribusi Kategori
                    </h3>
                    {categoryList.length > 0 ? (
                      <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
                        <motion.div
                          whileHover={{ scale: 1.05 }}
                          transition={{ type: "spring" }}
                          className="relative w-48 h-48 sm:w-56 sm:h-56 shrink-0 flex items-center justify-center rounded-full shadow-[0_10px_40px_rgba(0,0,0,0.1)]"
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
                        </motion.div>
                        <div className="w-full flex-1 space-y-3">
                          {categoryList.map((cat, idx) => (
                            <motion.div
                              initial={{ opacity: 0, x: 20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.05 }}
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
                            </motion.div>
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
                </motion.div>
              )}

              {/* --- KONTEN RIWAYAT --- */}
              {activeMenu === "history" && (
                <motion.div
                  key="history"
                  variants={tabVariants}
                  initial="hidden"
                  animate="enter"
                  exit="exit"
                  className="space-y-4"
                >
                  <div className="flex gap-2 mb-6">
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Search size={18} className="text-gray-400" />
                      </div>
                      <input
                        type="text"
                        placeholder="Cari..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-11 pr-4 py-3.5 bg-white/70 border border-white/60 backdrop-blur-xl rounded-2xl shadow-sm outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium transition-all text-gray-800 placeholder-gray-400"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery("")}
                          className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                    <select
                      value={historySort}
                      onChange={(e) => setHistorySort(e.target.value)}
                      className="bg-white/70 border border-white/60 backdrop-blur-xl rounded-2xl shadow-sm outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold text-gray-700 px-3 cursor-pointer"
                    >
                      <option value="newest">Terbaru</option>
                      <option value="oldest">Terlama</option>
                      <option value="a-z">A - Z</option>
                      <option value="z-a">Z - A</option>
                    </select>
                  </div>
                  <div>
                    {sortedAndFilteredHistory.length === 0 ? (
                      <p className="text-center text-gray-500 py-10">
                        {searchQuery
                          ? `Tidak ada hasil untuk "${searchQuery}"`
                          : "Belum ada riwayat transaksi."}
                      </p>
                    ) : (
                      sortedAndFilteredHistory.map((tx) => (
                        <TransactionCard key={tx.id} tx={tx} />
                      ))
                    )}
                  </div>
                </motion.div>
              )}

              {/* --- KONTEN PENGATURAN --- */}
              {activeMenu === "settings" && (
                <motion.div
                  key="settings"
                  variants={tabVariants}
                  initial="hidden"
                  animate="enter"
                  exit="exit"
                  className="space-y-6"
                >
                  <div className="bg-white/60 border border-white/60 backdrop-blur-xl rounded-[2.5rem] p-6 shadow-sm flex items-center gap-6">
                    <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center border-4 border-white shadow-sm overflow-hidden shrink-0">
                      <img
                        src={
                          currentUser?.photoURL ||
                          "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix"
                        }
                        alt="User"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-2xl font-bold text-gray-900 truncate">
                        {currentUser?.displayName || "Pengguna"}
                      </h3>
                      <p className="text-gray-500 truncate text-sm">
                        {currentUser?.email}
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
                      <AnimatePresence>
                        {categories.map((cat, idx) => (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
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
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder="Contoh: Bensin"
                        className="flex-1 p-3 bg-white border border-gray-200 rounded-xl font-medium text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-shadow min-w-0"
                      />
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={handleAddCategory}
                        className="bg-blue-600 text-white px-5 rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-sm shrink-0"
                      >
                        Tambah
                      </motion.button>
                    </div>
                  </div>
                  <div className="bg-white/60 border border-white/60 backdrop-blur-xl rounded-[2rem] p-4 shadow-sm space-y-2">
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      className="w-full flex items-center justify-between p-4 hover:bg-white/80 rounded-2xl transition-colors text-left"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
                          <Sparkles size={20} />
                        </div>
                        <span className="font-semibold text-gray-800">
                          Ubah Kunci API Gemini
                        </span>
                      </div>
                      <ChevronRight size={18} className="text-gray-400" />
                    </motion.button>

                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setShowAboutApp(true)}
                      className="w-full flex items-center justify-between p-4 hover:bg-white/80 rounded-2xl transition-colors text-left"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
                          <Info size={20} />
                        </div>
                        <span className="font-semibold text-gray-800">
                          Tentang Aplikasi
                        </span>
                      </div>
                      <ChevronRight size={18} className="text-gray-400" />
                    </motion.button>

                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={handleLogout}
                      className="w-full flex items-center justify-between p-4 hover:bg-gray-100 rounded-2xl transition-colors text-left border border-transparent mt-2"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-gray-200 text-gray-700 rounded-xl">
                          <LogOut size={20} />
                        </div>
                        <span className="font-semibold text-gray-700">
                          Keluar (Log Out)
                        </span>
                      </div>
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* --- COPYRIGHT DI DALAM HALAMAN UTAMA --- */}
            <div className="mt-8 pb-4 text-center w-full relative z-0">
              <p className="text-[10px] font-bold text-gray-400/80 tracking-widest uppercase">
                © 2026 Bale Teknisi
              </p>
            </div>
          </div>
        </main>

        <div className="md:hidden fixed bottom-6 left-6 right-6 z-30">
          <nav className="bg-white/80 backdrop-blur-2xl border border-white/60 rounded-[2rem] shadow-[0_20px_40px_rgba(0,0,0,0.12)] px-4 py-2 relative flex items-center justify-between">
            <div className="flex w-2/5 justify-around">
              <motion.button
                whileTap={{ scale: 0.8 }}
                onClick={() => setActiveMenu("home")}
                className={`p-2 transition-colors ${activeMenu === "home" ? "text-blue-600" : "text-gray-400"}`}
              >
                <Home size={24} strokeWidth={activeMenu === "home" ? 2.5 : 2} />
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.8 }}
                onClick={() => setActiveMenu("chart")}
                className={`p-2 transition-colors ${activeMenu === "chart" ? "text-blue-600" : "text-gray-400"}`}
              >
                <PieChart
                  size={24}
                  strokeWidth={activeMenu === "chart" ? 2.5 : 2}
                />
              </motion.button>
            </div>
            <div className="relative w-1/5 flex justify-center">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowActionSheet(true)}
                className="absolute -top-10 w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center shadow-[0_10px_25px_rgba(59,130,246,0.5)] border-4 border-[#F2F2F7] text-white"
              >
                <Plus size={32} strokeWidth={2.5} />
              </motion.button>
            </div>
            <div className="flex w-2/5 justify-around">
              <motion.button
                whileTap={{ scale: 0.8 }}
                onClick={() => setActiveMenu("history")}
                className={`p-2 transition-colors ${activeMenu === "history" ? "text-blue-600" : "text-gray-400"}`}
              >
                <History
                  size={24}
                  strokeWidth={activeMenu === "history" ? 2.5 : 2}
                />
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.8 }}
                onClick={() => setActiveMenu("settings")}
                className={`p-2 transition-colors ${activeMenu === "settings" ? "text-blue-600" : "text-gray-400"}`}
              >
                <SettingsIcon
                  size={24}
                  strokeWidth={activeMenu === "settings" ? 2.5 : 2}
                />
              </motion.button>
            </div>
          </nav>
        </div>

        {/* --- MODAL BERANIMASI TENTANG APLIKASI --- */}
        <AnimatePresence>
          {showAboutApp && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/60 backdrop-blur-md"
            >
              <div
                className="absolute inset-0"
                onClick={() => setShowAboutApp(false)}
              ></div>
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="w-full max-w-sm bg-white/95 backdrop-blur-3xl border border-white/50 rounded-[2.5rem] p-8 shadow-2xl relative text-center"
              >
                <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-[2rem] flex items-center justify-center text-white shadow-xl mx-auto mb-5 p-3">
                  <img
                    src="/logo-192.png"
                    alt="Logo NexaPay"
                    className="w-full h-full object-contain drop-shadow-sm"
                  />
                </div>
                <h3 className="text-2xl font-black text-gray-900 mb-1 tracking-tight">
                  NexaPay.
                </h3>
                <p className="text-sm font-bold text-blue-500 mb-6">
                  Versi 1.0.0
                </p>
                <div className="bg-gray-50 rounded-2xl p-5 mb-8 border border-gray-100 text-sm text-gray-600 leading-relaxed text-left shadow-inner">
                  <p>
                    <strong>NexaPay</strong> adalah asisten keuangan pribadi
                    yang ditenagai oleh kecerdasan buatan (Gemini AI).
                  </p>
                  <p className="mt-2">
                    Dikembangkan dengan antarmuka bergaya modern untuk
                    pengalaman mencatat transaksi yang otomatis, cepat, dan
                    cerdas.
                  </p>
                  <p className="mt-3 text-xs text-center text-gray-400 font-semibold uppercase tracking-wider">
                    © 2026 Bale Teknisi
                  </p>
                </div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowAboutApp(false)}
                  className="w-full py-4 bg-gray-900 text-white font-bold rounded-2xl shadow-lg hover:bg-gray-800 transition-colors"
                >
                  Tutup Informasi
                </motion.button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* --- MODAL BERANIMASI (TAMBAH TRANSAKSI) --- */}
        <AnimatePresence>
          {showActionSheet && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm"
            >
              <div
                className="absolute inset-0"
                onClick={() => setShowActionSheet(false)}
              ></div>
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="w-full md:max-w-md bg-white/95 backdrop-blur-2xl md:rounded-[2.5rem] rounded-t-[2.5rem] p-6 pb-12 md:pb-6 shadow-2xl relative"
              >
                <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6 md:hidden"></div>
                <h3 className="text-xl font-bold text-gray-900 mb-5 text-center">
                  Tambah Transaksi
                </h3>
                <div className="space-y-3">
                  <motion.button
                    whileTap={{ scale: 0.98 }}
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
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.98 }}
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
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.98 }}
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
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showManualInput && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm md:p-4"
            >
              <div
                className="absolute inset-0"
                onClick={() => setShowManualInput(false)}
              ></div>
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="w-full md:max-w-md bg-white rounded-t-[2.5rem] md:rounded-[2.5rem] p-6 shadow-2xl relative"
              >
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
                        setManualData({
                          ...manualData,
                          category: e.target.value,
                        })
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
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleSaveManual}
                  className="w-full mt-8 py-4 bg-blue-600 text-white rounded-xl font-bold text-lg shadow-lg shadow-blue-500/30"
                >
                  Simpan Data
                </motion.button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {imagePreview && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/60 backdrop-blur-md"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="w-full max-w-sm sm:max-w-md bg-white/90 backdrop-blur-2xl border border-white/60 p-6 rounded-[2.5rem] shadow-2xl flex flex-col max-h-[90vh]"
              >
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
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleProcessAI}
                  className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-bold shadow-lg"
                  disabled={isProcessing}
                >
                  {isProcessing
                    ? "Menganalisis dengan AI..."
                    : "Ekstrak Data Sekarang"}
                </motion.button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {selectedTransaction && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex items-center justify-center p-3 md:p-8 bg-black/60 backdrop-blur-md"
            >
              <div
                className="absolute inset-0"
                onClick={isEditing ? () => setIsEditing(false) : closePopup}
              ></div>
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="w-full max-w-[22rem] sm:max-w-sm bg-white/95 backdrop-blur-3xl border border-white/50 rounded-[2rem] p-5 sm:p-6 shadow-2xl relative flex flex-col max-h-[90vh]"
              >
                <div className="absolute top-5 right-5 flex gap-2">
                  {!isEditing && (
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleDelete(selectedTransaction.id)}
                      className="p-2 bg-red-50 text-red-500 rounded-full hover:bg-red-100"
                    >
                      <Trash2 size={18} />
                    </motion.button>
                  )}
                  {!isEditing ? (
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={startEditing}
                      className="p-2 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100"
                    >
                      <Pencil size={18} />
                    </motion.button>
                  ) : (
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={saveEdit}
                      className="p-2 bg-green-50 text-green-600 rounded-full hover:bg-green-100"
                    >
                      <Check size={18} strokeWidth={3} />
                    </motion.button>
                  )}
                </div>
                <div className="text-center mb-4 mt-2 px-6 flex flex-col items-center">
                  <div
                    className={`w-12 h-12 text-2xl rounded-2xl flex items-center justify-center mx-auto mb-2 ${selectedTransaction.type === "income" ? "bg-green-100" : "bg-gray-100"}`}
                  >
                    {isEditing ? editData.icon : selectedTransaction.icon}
                  </div>
                  {isEditing ? (
                    <div className="w-full space-y-2">
                      <input
                        type="text"
                        value={editData.store}
                        onChange={(e) =>
                          setEditData({ ...editData, store: e.target.value })
                        }
                        className="w-full text-center font-bold text-xl bg-gray-50 border border-gray-200 rounded-xl p-1.5 outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="datetime-local"
                        value={
                          editData.timestamp
                            ? new Date(
                                editData.timestamp -
                                  new Date().getTimezoneOffset() * 60000,
                              )
                                .toISOString()
                                .slice(0, 16)
                            : ""
                        }
                        onChange={(e) => {
                          const d = new Date(e.target.value);
                          setEditData({
                            ...editData,
                            timestamp: d.getTime(),
                            date: d
                              .toLocaleDateString("id-ID", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                              .replace(/\./g, ":"),
                          });
                        }}
                        className="w-full text-center text-xs font-semibold text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-1.5 outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  ) : (
                    <>
                      <h3 className="font-bold text-xl text-gray-900 leading-tight w-full break-words px-2">
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
                                  <p className="font-semibold text-gray-800 text-sm break-words leading-tight">
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
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={isEditing ? () => setIsEditing(false) : closePopup}
                  className={`w-full mt-6 py-3 rounded-xl font-bold text-base transition-colors shrink-0 ${isEditing ? "bg-red-50 text-red-600 hover:bg-red-100" : "bg-gray-100 text-gray-800 hover:bg-gray-200"}`}
                >
                  {isEditing ? "Batal Edit" : "Tutup Detail"}
                </motion.button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default App;
