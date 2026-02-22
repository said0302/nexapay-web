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
  Search,
  AlertCircle,
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

// --- KOMPONEN GRAFIK GARIS (BERANIMASI & GRADASI BARU) ---
const LineChart = ({
  data,
  colorStart = "#06b6d4",
  colorEnd = "#3b82f6",
  id = "chart",
}) => {
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
  const gradientId = `grad-${id}`;

  return (
    <div className="relative w-full h-32 sm:h-44 mt-4 mb-8">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="absolute inset-0 w-full h-full overflow-visible"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={colorStart} stopOpacity={0.5} />
            <stop offset="100%" stopColor={colorEnd} stopOpacity={0.1} />
          </linearGradient>
          <linearGradient
            id={`${gradientId}-stroke`}
            x1="0"
            y1="0"
            x2="1"
            y2="0"
          >
            <stop offset="0%" stopColor={colorStart} />
            <stop offset="100%" stopColor={colorEnd} />
          </linearGradient>
        </defs>
        <motion.path
          d={areaPath}
          fill={`url(#${gradientId})`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
        />
        <motion.path
          d={linePath}
          fill="none"
          stroke={`url(#${gradientId}-stroke)`}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="drop-shadow-[0_4px_6px_rgba(0,0,0,0.1)]"
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
            className="w-3 h-3 bg-white border-[3px] border-solid rounded-full transition-transform group-hover:scale-150 shadow-sm"
            style={{ borderColor: colorEnd }}
          ></div>
          <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-2 bg-gray-900/80 backdrop-blur-md text-white text-[10px] font-bold px-3 py-1.5 rounded-xl shadow-lg transition-opacity whitespace-nowrap pointer-events-none">
            Rp {(p.val / 1000).toLocaleString("id-ID")}K
          </div>
        </motion.div>
      ))}
      {points.map((p, i) => (
        <div
          key={`label-${i}`}
          className="absolute top-full mt-3 text-[9px] sm:text-[10px] font-bold text-gray-500/80 transform -translate-x-1/2 whitespace-nowrap"
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
  // --- PALET WARNA BARU (SESUAI LOGO) ---
  const pieColors = [
    "#06b6d4",
    "#3b82f6",
    "#8b5cf6",
    "#d946ef",
    "#f43f5e",
    "#f59e0b",
    "#10b981",
    "#14b8a6",
    "#6366f1",
    "#a855f7",
    "#64748b",
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
  const categoryData = {};
  filteredExpenseTransactions.forEach((tx) => {
    if (tx.items && tx.items.length > 0) {
      tx.items.forEach((item) => {
        let cat = categories.includes(item.category)
          ? item.category
          : "Lainnya";
        categoryData[cat] =
          (categoryData[cat] || 0) +
          (Number(item.qty) || 1) * (Number(item.price) || 0);
      });
    } else {
      let cat = categories.includes(tx.category) ? tx.category : "Lainnya";
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

          const newTransaction = {
            userId: currentUser.uid,
            timestamp: txTimestamp,
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
    if (categories.includes(newCategoryName.trim()))
      return showAlert(
        "Sudah Ada",
        `Kategori "${newCategoryName.trim()}" sudah ada!`,
      );
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
      className="group flex flex-col p-4 bg-white/60 backdrop-blur-xl border border-white/40 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)] rounded-[1.5rem] hover:bg-white/70 cursor-pointer shadow-sm mb-3 transition-all relative overflow-hidden"
    >
      <div
        className={`absolute left-0 inset-y-0 w-1 bg-gradient-to-b ${tx.type === "income" ? "from-teal-400 to-blue-500" : "from-violet-400 to-fuchsia-500"} opacity-60`}
      ></div>
      <div className="flex justify-between items-center pb-3 border-b border-gray-100/30 mb-3 gap-2 pl-3">
        <div className="flex items-center gap-3 flex-1 min-w-0 pr-2">
          <div
            className={`w-8 h-8 shrink-0 rounded-xl flex items-center justify-center text-[14px] shadow-sm ${tx.type === "income" ? "bg-gradient-to-br from-teal-50 to-blue-100 text-teal-600" : "bg-gradient-to-br from-violet-50 to-fuchsia-100 text-violet-600"}`}
          >
            {tx.icon}
          </div>
          <span className="text-xs font-bold text-gray-600 uppercase tracking-wider truncate">
            {tx.store}
          </span>
        </div>
        <span className="text-[10px] shrink-0 font-semibold text-gray-400/80 whitespace-nowrap">
          {tx.date}
        </span>
      </div>
      <div className="flex justify-between items-start gap-3 pl-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-gray-800 text-sm leading-snug truncate">
            {tx.items && tx.items.length > 0
              ? tx.items[0].name
              : tx.type === "income"
                ? "Pemasukan Dana"
                : "Pengeluaran"}
          </h4>
          {tx.items && tx.items.length > 1 && (
            <p className="text-[10px] font-bold text-blue-500/80 mt-1 bg-blue-50/50 inline-block px-2 py-0.5 rounded-full">
              + {tx.items.length - 1} produk lainnya
            </p>
          )}
        </div>
        <div className="text-right shrink-0 whitespace-nowrap pl-2">
          <span
            className={`font-black text-sm md:text-base block bg-clip-text text-transparent ${tx.type === "income" ? "bg-gradient-to-r from-teal-500 to-blue-600" : "bg-gradient-to-r from-violet-500 to-fuchsia-600"}`}
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-teal-500 animate-pulse">
        Memuat NexaPay...
      </div>
    );

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex justify-center items-center font-sans p-6 relative overflow-hidden">
        <div className="absolute top-[-20%] left-[-20%] w-[40rem] h-[40rem] bg-cyan-400/20 rounded-full blur-[120px] pointer-events-none mix-blend-multiply"></div>
        <div className="absolute bottom-[-20%] right-[-20%] w-[40rem] h-[40rem] bg-violet-400/20 rounded-full blur-[120px] pointer-events-none mix-blend-multiply"></div>
        <AnimatePresence>
          {dialog.isOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-md"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="w-full max-w-xs bg-gray-900/80 backdrop-blur-3xl border border-white/10 rounded-[2rem] p-6 shadow-2xl text-center relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10 pointer-events-none"></div>
                <div className="w-14 h-14 bg-gradient-to-br from-red-500 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-red-500/20 relative z-10">
                  <AlertCircle size={28} className="text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2 relative z-10">
                  {dialog.title}
                </h3>
                <p className="text-sm text-gray-300 mb-6 relative z-10 leading-relaxed">
                  {dialog.message}
                </p>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={closeDialog}
                  className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-teal-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 relative z-10"
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
          className="w-full max-w-md bg-white/40 backdrop-blur-3xl border border-white/60 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.4)] p-10 rounded-[3rem] shadow-2xl text-center relative z-10"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.2 }}
            className="w-24 h-24 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-[2rem] flex items-center justify-center text-white shadow-2xl shadow-blue-500/30 mx-auto mb-8"
          >
            <ScanLine size={48} />
          </motion.div>
          <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-teal-500 mb-3 tracking-tight">
            NexaPay.
          </h1>
          <p className="text-gray-500 mb-10 font-medium text-base leading-relaxed">
            Aplikasi Keuangan Pintar Berbasis AI <br /> dengan Sentuhan Masa
            Depan.
          </p>
          <motion.button
            whileTap={{ scale: 0.95 }}
            whileHover={{
              scale: 1.02,
              boxShadow: "0 20px 40px -15px rgba(59, 130, 246, 0.4)",
            }}
            onClick={handleLogin}
            className="w-full bg-gradient-to-r from-gray-900 via-blue-900 to-gray-900 text-white p-4 rounded-2xl flex items-center justify-center gap-4 shadow-xl transition-all relative overflow-hidden group"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <svg className="w-6 h-6 relative z-10" viewBox="0 0 24 24">
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
            <span className="font-bold text-lg relative z-10">
              Masuk dengan Google
            </span>
          </motion.button>
        </motion.div>
      </div>
    );
  }

  const tabVariants = {
    hidden: { opacity: 0, x: 20, scale: 0.95 },
    enter: {
      opacity: 1,
      x: 0,
      scale: 1,
      transition: { duration: 0.4, ease: [0.23, 1, 0.32, 1] },
    }, // iOS spring-like curve
    exit: {
      opacity: 0,
      x: -20,
      scale: 0.95,
      transition: { duration: 0.3, ease: [0.23, 1, 0.32, 1] },
    },
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] md:bg-gray-50 p-0 md:p-8 flex justify-center items-center font-sans relative overflow-hidden">
      {/* --- BACKGROUND AURORA BARU (SESUAI LOGO) --- */}
      <div className="absolute top-[-25%] left-[-25%] w-[50rem] h-[50rem] bg-cyan-400/25 rounded-full blur-[140px] pointer-events-none mix-blend-multiply animate-pulse-slow"></div>
      <div
        className="absolute bottom-[-25%] right-[-25%] w-[50rem] h-[50rem] bg-violet-400/25 rounded-full blur-[140px] pointer-events-none mix-blend-multiply animate-pulse-slow"
        style={{ animationDelay: "2s" }}
      ></div>

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
            className="absolute inset-0 z-[100] flex items-center justify-center p-5 bg-gray-900/60 backdrop-blur-md"
          >
            {/* --- DIALOG BOX BARU: DARK GLASS PREMIUM --- */}
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="w-full max-w-[22rem] bg-gray-900/85 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-8 shadow-2xl text-center relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10 pointer-events-none"></div>
              <h3 className="text-2xl font-black text-white mb-3 relative z-10">
                {dialog.title}
              </h3>
              <p className="text-base font-medium text-gray-300 mb-8 leading-relaxed relative z-10">
                {dialog.message}
              </p>
              <div className="flex gap-4 relative z-10">
                {dialog.type === "confirm" && (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={closeDialog}
                    className="flex-1 py-4 bg-white/10 border border-white/5 text-white font-bold rounded-2xl hover:bg-white/20 transition-colors backdrop-blur-md"
                  >
                    Batal
                  </motion.button>
                )}
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  whileHover={{
                    boxShadow: "0 10px 30px -10px rgba(59, 130, 246, 0.5)",
                  }}
                  onClick={() => {
                    if (dialog.onConfirm) dialog.onConfirm();
                    closeDialog();
                  }}
                  className={`flex-1 py-4 text-white font-bold rounded-2xl shadow-xl relative overflow-hidden group ${dialog.type === "confirm" ? "" : "bg-gradient-to-r from-gray-800 to-gray-900"}`}
                >
                  {dialog.type === "confirm" && (
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 bg-[length:200%_auto] animate-gradient"></div>
                  )}
                  <span className="relative z-10">
                    {dialog.type === "confirm" ? "Oke, Lanjutkan" : "Mengerti"}
                  </span>
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="w-full h-screen md:h-[90vh] md:max-w-6xl md:bg-white/30 md:backdrop-blur-3xl md:border md:border-white/50 md:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.3)] md:rounded-[3.5rem] md:shadow-[0_60px_120px_-30px_rgba(0,0,0,0.2)] flex flex-col md:flex-row overflow-hidden relative transition-all duration-500 z-10">
        <aside className="hidden md:flex flex-col w-80 bg-white/20 border-r border-white/40 p-10 z-10 backdrop-blur-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-white/30 to-transparent opacity-50 pointer-events-none"></div>
          <div className="flex items-center gap-4 mb-14 relative z-10">
            <div className="w-12 h-12 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
              <ScanLine size={26} />
            </div>
            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-teal-500 tracking-tight">
              NexaPay.
            </h1>
          </div>
          <nav className="flex-1 space-y-4 relative z-10">
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
                className={`w-full flex items-center gap-5 px-6 py-4 rounded-[1.2rem] transition-all duration-300 group relative overflow-hidden ${activeMenu === menu.id ? "shadow-lg shadow-blue-500/10" : "hover:bg-white/40"}`}
              >
                {activeMenu === menu.id && (
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-blue-200/50 rounded-[1.2rem]"></div>
                )}
                <menu.icon
                  size={24}
                  strokeWidth={activeMenu === menu.id ? 2.5 : 2}
                  className={`relative z-10 transition-colors ${activeMenu === menu.id ? "text-blue-600 drop-shadow-sm" : "text-gray-500 group-hover:text-gray-700"}`}
                />
                <span
                  className={`font-bold text-base relative z-10 transition-colors ${activeMenu === menu.id ? "text-blue-700" : "text-gray-600 group-hover:text-gray-900"}`}
                >
                  {menu.label}
                </span>
              </motion.button>
            ))}
          </nav>
          <motion.button
            whileTap={{ scale: 0.95 }}
            whileHover={{
              scale: 1.03,
              boxShadow: "0 20px 40px -15px rgba(59, 130, 246, 0.5)",
            }}
            onClick={() => setShowActionSheet(true)}
            className="mt-auto w-full relative z-10 overflow-hidden rounded-3xl p-0.5 group"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 bg-[length:200%_auto] animate-gradient"></div>
            <div className="relative bg-gray-900/90 hover:bg-gray-900/80 backdrop-blur-xl h-full w-full text-white p-5 rounded-[1.4rem] flex items-center justify-center gap-3 shadow-2xl transition-colors">
              <Plus size={22} strokeWidth={2.5} className="text-cyan-300" />{" "}
              <span className="font-black text-lg tracking-wide">
                Tambah Transaksi
              </span>
            </div>
          </motion.button>
        </aside>

        <main className="flex-1 flex flex-col h-full relative overflow-hidden bg-transparent md:bg-white/5">
          <header className="px-6 md:px-12 pt-8 md:pt-12 pb-6 flex justify-between items-center z-10 shrink-0 relative">
            <div>
              <p className="text-transparent bg-clip-text bg-gradient-to-r from-gray-500 to-gray-700 text-sm font-bold mb-1 md:hidden uppercase tracking-wider">
                Halo, {currentUser?.displayName?.split(" ")[0]}
              </p>
              <h2 className="text-4xl font-black text-gray-900 tracking-tight">
                {activeMenu === "home"
                  ? "Beranda"
                  : activeMenu === "chart"
                    ? "Analisis"
                    : activeMenu === "settings"
                      ? "Pengaturan"
                      : "Riwayat Belanja"}
              </h2>
            </div>
            <div className="p-1 rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 shadow-lg shadow-blue-500/20">
              <img
                src={
                  currentUser?.photoURL ||
                  "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix"
                }
                className="w-12 h-12 rounded-full border-4 border-white/90"
                alt="Profile"
              />
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-6 md:px-12 pb-36 md:pb-12 no-scrollbar z-10 overflow-x-hidden relative">
            {/* Efek Cahaya di Konten */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-64 bg-gradient-to-b from-white/60 to-transparent pointer-events-none mix-blend-overlay opacity-70"></div>

            <AnimatePresence mode="wait">
              {/* --- KONTEN BERANDA BARU --- */}
              {activeMenu === "home" && (
                <motion.div
                  key="home"
                  variants={tabVariants}
                  initial="hidden"
                  animate="enter"
                  exit="exit"
                  className="grid grid-cols-1 md:grid-cols-12 gap-8"
                >
                  <div className="md:col-span-7 flex flex-col gap-6">
                    {/* KARTU SALDO: GRADASI BIRU-TEAL */}
                    <motion.div
                      whileHover={{ scale: 1.01, translateY: -5 }}
                      className="relative p-8 rounded-[2.5rem] border border-white/40 bg-white/30 backdrop-blur-3xl shadow-[0_30px_60px_-20px_rgba(0,150,255,0.25),inset_0_1px_1px_rgba(255,255,255,0.4)] overflow-hidden group cursor-default relative"
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/80 to-blue-600/80 mix-blend-multiply"></div>
                      <div className="absolute top-[-50%] right-[-30%] w-80 h-80 bg-white/30 rounded-full blur-[80px] mix-blend-overlay pointer-events-none group-hover:scale-110 transition-transform duration-700"></div>
                      <div className="relative z-10 text-white flex flex-col justify-center">
                        <div className="flex items-center gap-3 mb-3 opacity-90">
                          <div className="p-2 bg-white/20 rounded-xl backdrop-blur-md">
                            <Wallet size={22} className="text-cyan-100" />
                          </div>
                          <p className="text-sm font-bold uppercase tracking-widest text-cyan-50">
                            Sisa Saldo
                          </p>
                        </div>
                        <h2 className="text-4xl sm:text-5xl md:text-5xl font-black tracking-tighter drop-shadow-md truncate bg-clip-text text-transparent bg-gradient-to-b from-white to-cyan-100">
                          Rp {currentBalance.toLocaleString("id-ID")}
                        </h2>
                        <p className="text-sm sm:text-base font-semibold text-cyan-100/90 mt-2 tracking-wide">
                          ~ {formatTerbilang(currentBalance)}
                        </p>
                      </div>
                    </motion.div>
                    {/* KARTU PENGELUARAN: GRADASI UNGU-VIOLET */}
                    <motion.div
                      whileHover={{ scale: 1.01, translateY: -5 }}
                      className="relative p-8 rounded-[2.5rem] border border-white/40 bg-white/30 backdrop-blur-3xl shadow-[0_30px_60px_-20px_rgba(150,0,255,0.25),inset_0_1px_1px_rgba(255,255,255,0.4)] overflow-hidden group cursor-default relative"
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-violet-400/80 to-fuchsia-600/80 mix-blend-multiply"></div>
                      <div className="absolute bottom-[-40%] left-[-20%] w-80 h-80 bg-white/30 rounded-full blur-[80px] mix-blend-overlay pointer-events-none group-hover:scale-110 transition-transform duration-700"></div>
                      <div className="relative z-10 text-white flex flex-col justify-center">
                        <div className="flex items-center gap-3 mb-3 opacity-90">
                          <div className="p-2 bg-white/20 rounded-xl backdrop-blur-md">
                            <ArrowDownCircle
                              size={22}
                              className="text-violet-100"
                            />
                          </div>
                          <p className="text-sm font-bold uppercase tracking-widest text-violet-50">
                            Total Pengeluaran
                          </p>
                        </div>
                        <h2 className="text-4xl sm:text-5xl md:text-5xl font-black tracking-tighter drop-shadow-md truncate bg-clip-text text-transparent bg-gradient-to-b from-white to-violet-100">
                          Rp {totalExpense.toLocaleString("id-ID")}
                        </h2>
                        <p className="text-sm sm:text-base font-semibold text-violet-100/90 mt-2 tracking-wide">
                          ~ {formatTerbilang(totalExpense)}
                        </p>
                      </div>
                    </motion.div>
                  </div>
                  <div className="md:col-span-5 flex flex-col gap-8">
                    <div className="bg-white/50 border border-white/60 backdrop-blur-3xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.3)] rounded-[2.5rem] p-6 shadow-xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-40 h-40 bg-blue-400/10 rounded-full blur-[60px] pointer-events-none"></div>
                      <div className="flex justify-between items-center mb-6 relative z-10">
                        <h3 className="text-lg font-black text-gray-900">
                          Statistik{" "}
                          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-teal-500">
                            Minggu Ini
                          </span>
                        </h3>
                        <select
                          value={homeChartFilter}
                          onChange={(e) => setHomeChartFilter(e.target.value)}
                          className="text-xs bg-white/80 border border-blue-100 rounded-xl p-2 px-3 font-bold text-blue-600 outline-none cursor-pointer shadow-sm hover:bg-white transition-colors"
                        >
                          <option value="Mingguan">Minggu Ini</option>
                          <option value="Bulanan">Bulan Ini</option>
                          <option value="Tahunan">Tahun Ini</option>
                        </select>
                      </div>
                      <div className="mb-1 relative z-10">
                        <h4 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-blue-900 truncate flex items-end">
                          Rp {homeTotal.toLocaleString("id-ID")}
                        </h4>
                      </div>
                      {/* LINE CHART DENGAN GRADASI LOGO BARU */}
                      <LineChart
                        data={homeChartData}
                        colorStart="#2dd4bf"
                        colorEnd="#3b82f6"
                        id="homeChart"
                      />
                    </div>
                    <div className="bg-white/40 border border-white/50 backdrop-blur-3xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.3)] rounded-[3rem] p-8 shadow-xl flex flex-col flex-1 relative overflow-hidden">
                      <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-white/60 to-transparent pointer-events-none z-20"></div>
                      <div className="flex justify-between items-end mb-8 shrink-0 relative z-10">
                        <h3 className="text-2xl font-black text-gray-900 tracking-tight">
                          Terbaru
                        </h3>
                        <button
                          onClick={() => setActiveMenu("history")}
                          className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 text-sm font-bold flex items-center hover:opacity-80 transition-opacity"
                        >
                          Semua{" "}
                          <ChevronRight
                            size={18}
                            className="text-purple-500 ml-1"
                          />
                        </button>
                      </div>
                      <div className="flex-1 overflow-y-auto no-scrollbar relative z-10 -mx-2 px-2 pb-10">
                        {transactions.length === 0 ? (
                          <p className="text-sm text-gray-500 text-center py-10 font-medium bg-white/30 rounded-[2rem]">
                            Belum ada data transaksi.
                          </p>
                        ) : (
                          transactions
                            .slice(0, 5)
                            .map((tx) => (
                              <TransactionCard key={tx.id} tx={tx} />
                            ))
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* --- KONTEN ANALISIS BARU --- */}
              {activeMenu === "chart" && (
                <motion.div
                  key="chart"
                  variants={tabVariants}
                  initial="hidden"
                  animate="enter"
                  exit="exit"
                  className="space-y-8"
                >
                  <motion.div
                    whileHover={{ scale: 1.01, translateY: -5 }}
                    className="relative p-8 md:p-10 rounded-[2.5rem] border border-white/20 bg-gray-900/90 backdrop-blur-3xl shadow-2xl overflow-hidden group cursor-default"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-900/60 via-gray-900/80 to-purple-900/60"></div>
                    <div className="absolute top-[-50%] left-[-20%] w-[30rem] h-[30rem] bg-cyan-500/20 rounded-full blur-[100px] pointer-events-none mix-blend-screen animate-pulse-slow"></div>
                    <div
                      className="absolute bottom-[-50%] right-[-20%] w-[30rem] h-[30rem] bg-violet-500/20 rounded-full blur-[100px] pointer-events-none mix-blend-screen animate-pulse-slow"
                      style={{ animationDelay: "1.5s" }}
                    ></div>
                    <div className="relative z-10 text-white">
                      <div className="flex items-center gap-3 mb-3 opacity-80">
                        <div className="p-2 bg-white/10 rounded-xl backdrop-blur-md">
                          <CalendarDays size={20} className="text-cyan-200" />
                        </div>
                        <p className="text-sm font-bold uppercase tracking-widest text-cyan-100">
                          {chartFilter === "Mingguan"
                            ? "7 Hari Terakhir"
                            : chartFilter === "Bulanan"
                              ? `${monthNames[selectedMonth]} ${selectedYear}`
                              : chartFilter === "Tahunan"
                                ? `Tahun ${selectedYear}`
                                : "Seluruh Waktu"}
                        </p>
                      </div>
                      <h3 className="text-5xl sm:text-6xl font-black truncate bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-400">
                        Rp {filteredTotalExpense.toLocaleString("id-ID")}
                      </h3>
                      <p className="text-sm sm:text-base font-semibold text-gray-300 mt-3 tracking-wide">
                        ~ {formatTerbilang(filteredTotalExpense)}
                      </p>
                    </div>
                  </motion.div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                    <div className="md:col-span-7 bg-white/50 border border-white/60 backdrop-blur-3xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.3)] rounded-[3rem] p-8 shadow-xl relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-64 h-64 bg-purple-400/10 rounded-full blur-[80px] pointer-events-none"></div>
                      <div className="flex p-1.5 bg-white/60 backdrop-blur-md border border-white/50 shadow-sm rounded-2xl mb-8 mx-auto w-full max-w-md relative z-10">
                        {["Mingguan", "Bulanan", "Tahunan", "Semua"].map(
                          (filter) => (
                            <motion.button
                              whileTap={{ scale: 0.95 }}
                              key={filter}
                              onClick={() => setChartFilter(filter)}
                              className={`flex-1 py-2.5 text-xs md:text-sm font-black rounded-xl transition-all relative overflow-hidden ${chartFilter === filter ? "text-white shadow-lg" : "text-gray-500 hover:text-gray-800"}`}
                            >
                              {chartFilter === filter && (
                                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 -z-10"></div>
                              )}
                              {filter}
                            </motion.button>
                          ),
                        )}
                      </div>
                      {chartFilter !== "Mingguan" &&
                        chartFilter !== "Semua" && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex justify-center gap-3 mb-4 relative z-10"
                          >
                            {chartFilter === "Bulanan" && (
                              <select
                                value={selectedMonth}
                                onChange={(e) =>
                                  setSelectedMonth(Number(e.target.value))
                                }
                                className="p-2.5 px-4 bg-white/80 border border-purple-100 rounded-xl text-sm font-bold text-purple-700 outline-none shadow-sm cursor-pointer hover:bg-white transition-colors"
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
                              className="p-2.5 px-4 bg-white/80 border border-purple-100 rounded-xl text-sm font-bold text-purple-700 outline-none shadow-sm cursor-pointer hover:bg-white transition-colors"
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
                        colorStart="#8b5cf6"
                        colorEnd="#d946ef"
                        id="analysisChart"
                      />
                    </div>

                    <div className="md:col-span-5 bg-white/50 border border-white/60 backdrop-blur-3xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.3)] rounded-[3rem] p-8 shadow-xl relative overflow-hidden">
                      <div className="absolute bottom-0 right-0 w-64 h-64 bg-cyan-400/10 rounded-full blur-[80px] pointer-events-none"></div>
                      <h3 className="text-xl font-black text-gray-900 mb-8 text-center relative z-10">
                        Distribusi Kategori
                      </h3>
                      {categoryList.length > 0 ? (
                        <div className="flex flex-col items-center gap-8 relative z-10">
                          <motion.div
                            whileHover={{ scale: 1.05, rotate: 2 }}
                            transition={{ type: "spring", stiffness: 200 }}
                            className="relative w-56 h-56 shrink-0 flex items-center justify-center rounded-full p-1 shadow-[0_20px_50px_rgba(0,0,0,0.15),inset_0_2px_4px_rgba(255,255,255,0.5)]"
                            style={{
                              background: `conic-gradient(${pieGradientStops})`,
                            }}
                          >
                            <div className="w-40 h-40 bg-white/90 backdrop-blur-xl rounded-full flex flex-col items-center justify-center shadow-[inset_0_5px_15px_rgba(0,0,0,0.05)] border border-white/80">
                              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
                                Total
                              </p>
                              <p className="text-lg sm:text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 truncate max-w-[120px]">
                                Rp {(filteredTotalExpense / 1000).toFixed(0)}K
                              </p>
                            </div>
                          </motion.div>
                          <div className="w-full space-y-3 max-h-72 overflow-y-auto no-scrollbar px-2 pb-4">
                            {categoryList.map((cat, idx) => (
                              <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                key={idx}
                                className="flex items-center gap-4 p-3 hover:bg-white/60 rounded-2xl transition-colors border border-transparent hover:border-white/40 hover:shadow-sm"
                              >
                                <div
                                  className="w-4 h-4 rounded-lg shadow-sm shrink-0 ring-2 ring-white"
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
                                  <p className="text-[10px] font-bold text-gray-500/80">
                                    {cat.percentage}%
                                  </p>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="h-64 flex flex-col items-center justify-center opacity-40">
                          <PieChart size={64} className="text-gray-400 mb-4" />
                          <p className="text-base font-bold text-gray-500">
                            Belum ada data.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* --- KONTEN RIWAYAT BARU --- */}
              {activeMenu === "history" && (
                <motion.div
                  key="history"
                  variants={tabVariants}
                  initial="hidden"
                  animate="enter"
                  exit="exit"
                  className="space-y-6"
                >
                  <div className="flex gap-4 mb-8 p-2 bg-white/40 backdrop-blur-xl border border-white/50 shadow-sm rounded-[2rem]">
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                        <Search size={20} className="text-blue-500/60" />
                      </div>
                      <input
                        type="text"
                        placeholder="Cari transaksi..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-14 pr-4 py-4 bg-white/60 border border-white/40 backdrop-blur-xl rounded-3xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)] outline-none focus:ring-2 focus:ring-blue-500/50 text-sm font-bold transition-all text-gray-800 placeholder-gray-400/80 focus:bg-white/80"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery("")}
                          className="absolute inset-y-0 right-3 flex items-center p-2 text-gray-400 hover:text-red-500 hover:bg-red-50/50 rounded-full transition-all"
                        >
                          <X size={18} />
                        </button>
                      )}
                    </div>
                    <select
                      value={historySort}
                      onChange={(e) => setHistorySort(e.target.value)}
                      className="bg-white/60 border border-white/40 backdrop-blur-xl rounded-3xl shadow-sm outline-none focus:ring-2 focus:ring-blue-500/50 text-sm font-black text-blue-700 px-5 cursor-pointer hover:bg-white/80 transition-all appearance-none relative pr-10"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%233b82f6' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                        backgroundPosition: `right 1rem center`,
                        backgroundSize: `1.2em 1.2em`,
                        backgroundRepeat: "no-repeat",
                      }}
                    >
                      <option value="newest">Terbaru</option>
                      <option value="oldest">Terlama</option>
                      <option value="a-z">A - Z</option>
                      <option value="z-a">Z - A</option>
                    </select>
                  </div>
                  <div className="pb-10">
                    {sortedAndFilteredHistory.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20 opacity-50 gap-4">
                        <History size={48} className="text-gray-300" />
                        <p className="text-lg font-bold text-gray-500">
                          {searchQuery
                            ? `Tidak ada hasil untuk "${searchQuery}"`
                            : "Belum ada riwayat transaksi."}
                        </p>
                      </div>
                    ) : (
                      sortedAndFilteredHistory.map((tx) => (
                        <TransactionCard key={tx.id} tx={tx} />
                      ))
                    )}
                  </div>
                </motion.div>
              )}

              {/* --- KONTEN PENGATURAN BARU --- */}
              {activeMenu === "settings" && (
                <motion.div
                  key="settings"
                  variants={tabVariants}
                  initial="hidden"
                  animate="enter"
                  exit="exit"
                  className="space-y-8"
                >
                  <div className="bg-white/50 border border-white/60 backdrop-blur-3xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.3)] rounded-[3rem] p-8 shadow-xl flex items-center gap-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-400/10 rounded-full blur-[80px] pointer-events-none"></div>
                    <div className="w-28 h-28 p-1 bg-gradient-to-br from-cyan-400 to-purple-600 rounded-full shadow-2xl relative z-10">
                      <div className="w-full h-full rounded-full border-[4px] border-white overflow-hidden bg-white">
                        <img
                          src={
                            currentUser?.photoURL ||
                            "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix"
                          }
                          alt="User"
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    </div>
                    <div className="min-w-0 relative z-10 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-full bg-blue-100/50 text-blue-600 text-[10px] font-black uppercase tracking-widest border border-blue-200/50">
                          Pengguna
                        </span>
                      </div>
                      <h3 className="text-3xl font-black text-gray-900 truncate">
                        {currentUser?.displayName || "Pengguna NexaPay"}
                      </h3>
                      <p className="text-lg font-medium text-gray-500 truncate">
                        {currentUser?.email}
                      </p>
                    </div>
                  </div>

                  <div className="bg-white/50 border border-white/60 backdrop-blur-3xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.3)] rounded-[3rem] p-8 shadow-xl relative overflow-hidden">
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-400/10 rounded-full blur-[80px] pointer-events-none"></div>
                    <div className="flex items-center gap-4 mb-6 relative z-10">
                      <div className="p-3 bg-gradient-to-br from-violet-100 to-fuchsia-100 text-violet-600 rounded-2xl shadow-sm">
                        <Tags size={24} />
                      </div>
                      <h3 className="text-2xl font-black text-gray-900">
                        Kategori Belanja
                      </h3>
                    </div>
                    <div className="flex flex-wrap gap-3 mb-8 relative z-10">
                      <AnimatePresence>
                        {categories.map((cat, idx) => (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            key={idx}
                            className="flex items-center gap-2 bg-white/70 border border-white/50 text-gray-700 pl-4 pr-2 py-2.5 rounded-2xl text-sm font-bold shadow-sm hover:shadow-md transition-all hover:bg-white hover:text-blue-600 group"
                          >
                            <span>{cat}</span>
                            {cat !== "Lainnya" && (
                              <button
                                onClick={() => handleDeleteCategory(cat)}
                                className="text-gray-300 hover:text-red-500 p-1.5 rounded-xl hover:bg-red-50/50 transition-colors group-hover:text-gray-400"
                              >
                                <X size={16} strokeWidth={2.5} />
                              </button>
                            )}
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                    <div className="flex gap-3 relative z-10">
                      <input
                        type="text"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder="Kategori baru..."
                        className="flex-1 p-4 bg-white/70 border border-white/50 rounded-2xl font-bold text-base outline-none focus:ring-2 focus:ring-blue-500/50 transition-all shadow-sm focus:bg-white"
                      />
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={handleAddCategory}
                        className="bg-gradient-to-r from-blue-600 to-teal-500 text-white px-8 rounded-2xl font-black shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transition-shadow"
                      >
                        Tambah
                      </motion.button>
                    </div>
                  </div>

                  <div className="bg-white/50 border border-white/60 backdrop-blur-3xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.3)] rounded-[3rem] p-6 shadow-xl space-y-3 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-400/10 rounded-full blur-[80px] pointer-events-none"></div>
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      className="w-full flex items-center justify-between p-5 hover:bg-white/60 rounded-[2rem] transition-colors text-left group relative z-10"
                    >
                      <div className="flex items-center gap-5">
                        <div className="p-3 bg-gradient-to-br from-blue-100 to-cyan-100 text-blue-600 rounded-2xl shadow-sm group-hover:scale-110 transition-transform">
                          <Sparkles size={24} />
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-900 text-lg mb-0.5">
                            Kunci API Gemini AI
                          </h4>
                          <p className="text-xs font-medium text-gray-500">
                            Atur otak kecerdasan buatan.
                          </p>
                        </div>
                      </div>
                      <ChevronRight
                        size={20}
                        className="text-gray-300 group-hover:text-blue-500 transition-colors"
                      />
                    </motion.button>
                    <div className="h-px w-full bg-gray-200/50 my-1 relative z-10"></div>
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={handleLogout}
                      className="w-full flex items-center justify-between p-5 hover:bg-red-50/50 rounded-[2rem] transition-colors text-left group relative z-10"
                    >
                      <div className="flex items-center gap-5">
                        <div className="p-3 bg-gray-100 text-gray-600 rounded-2xl shadow-sm group-hover:bg-red-100 group-hover:text-red-600 transition-colors group-hover:scale-110">
                          <LogOut size={24} />
                        </div>
                        <span className="font-bold text-lg text-gray-700 group-hover:text-red-700 transition-colors">
                          Keluar Akun
                        </span>
                      </div>
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>

        {/* --- BOTTOM NAVIGATION BARU (MOBILE) --- */}
        <div className="md:hidden fixed bottom-6 left-6 right-6 z-30">
          <nav className="bg-white/70 backdrop-blur-3xl border border-white/50 rounded-[2.5rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.15),inset_0_1px_0_0_rgba(255,255,255,0.4)] px-6 py-3 relative flex items-center justify-between overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent pointer-events-none"></div>
            <div className="flex w-2/5 justify-around relative z-10">
              <motion.button
                whileTap={{ scale: 0.8 }}
                onClick={() => setActiveMenu("home")}
                className={`p-3 rounded-2xl transition-all ${activeMenu === "home" ? "text-blue-600 bg-blue-50/50 shadow-sm" : "text-gray-400"}`}
              >
                <Home size={26} strokeWidth={activeMenu === "home" ? 2.5 : 2} />
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.8 }}
                onClick={() => setActiveMenu("chart")}
                className={`p-3 rounded-2xl transition-all ${activeMenu === "chart" ? "text-blue-600 bg-blue-50/50 shadow-sm" : "text-gray-400"}`}
              >
                <PieChart
                  size={26}
                  strokeWidth={activeMenu === "chart" ? 2.5 : 2}
                />
              </motion.button>
            </div>
            <div className="relative w-1/5 flex justify-center z-20">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowActionSheet(true)}
                className="absolute -top-12 w-[4.5rem] h-[4.5rem] p-0.5 rounded-full flex items-center justify-center shadow-[0_15px_35px_rgba(59,130,246,0.4)] border-[5px] border-[#F8FAFC] overflow-hidden group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 bg-[length:200%_auto] animate-gradient"></div>
                <div className="relative bg-gray-900/90 h-full w-full rounded-full flex items-center justify-center text-white backdrop-blur-md">
                  <Plus size={30} strokeWidth={3} className="text-cyan-200" />
                </div>
              </motion.button>
            </div>
            <div className="flex w-2/5 justify-around relative z-10">
              <motion.button
                whileTap={{ scale: 0.8 }}
                onClick={() => setActiveMenu("history")}
                className={`p-3 rounded-2xl transition-all ${activeMenu === "history" ? "text-blue-600 bg-blue-50/50 shadow-sm" : "text-gray-400"}`}
              >
                <History
                  size={26}
                  strokeWidth={activeMenu === "history" ? 2.5 : 2}
                />
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.8 }}
                onClick={() => setActiveMenu("settings")}
                className={`p-3 rounded-2xl transition-all ${activeMenu === "settings" ? "text-blue-600 bg-blue-50/50 shadow-sm" : "text-gray-400"}`}
              >
                <SettingsIcon
                  size={26}
                  strokeWidth={activeMenu === "settings" ? 2.5 : 2}
                />
              </motion.button>
            </div>
          </nav>
        </div>

        {/* --- MODAL TAMBAH TRANSAKSI BARU --- */}
        <AnimatePresence>
          {showActionSheet && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex items-end md:items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4"
            >
              <div
                className="absolute inset-0"
                onClick={() => setShowActionSheet(false)}
              ></div>
              <motion.div
                initial={{ y: "100%", scale: 0.95 }}
                animate={{ y: 0, scale: 1 }}
                exit={{ y: "100%", scale: 0.95 }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="w-full md:max-w-lg bg-white/80 backdrop-blur-[40px] border border-white/60 md:rounded-[3.5rem] rounded-t-[3.5rem] p-8 pb-14 md:pb-8 shadow-2xl relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-white/50 to-transparent pointer-events-none"></div>
                <div className="w-16 h-1.5 bg-gray-300/50 rounded-full mx-auto mb-8 md:hidden relative z-10"></div>
                <h3 className="text-3xl font-black text-gray-900 mb-8 text-center tracking-tight relative z-10">
                  Tambah Transaksi
                </h3>
                <div className="space-y-4 relative z-10">
                  {[
                    {
                      icon: Camera,
                      title: "Scan Kamera",
                      desc: "Auto-ekstrak struk dengan AI",
                      color: "blue",
                      onClick: () => cameraInputRef.current.click(),
                    },
                    {
                      icon: ImageIcon,
                      title: "Upload Galeri",
                      desc: "Pilih foto struk dari HP",
                      color: "purple",
                      onClick: () => galleryInputRef.current.click(),
                    },
                    {
                      icon: Pencil,
                      title: "Input Manual",
                      desc: "Tulis Pemasukan/Pengeluaran",
                      color: "cyan",
                      onClick: () => {
                        setShowActionSheet(false);
                        setShowManualInput(true);
                      },
                    },
                  ].map((item, idx) => (
                    <motion.button
                      key={idx}
                      whileTap={{ scale: 0.97 }}
                      onClick={item.onClick}
                      className="w-full flex items-center gap-6 p-5 bg-white/60 border border-white/60 rounded-[2rem] text-left shadow-sm hover:bg-white/80 hover:shadow-md transition-all group"
                    >
                      <div
                        className={`p-5 bg-gradient-to-br from-${item.color}-100 to-${item.color}-50 text-${item.color}-600 rounded-3xl shadow-sm group-hover:scale-110 transition-transform`}
                      >
                        <item.icon size={28} />
                      </div>
                      <div>
                        <p className="font-black text-gray-900 text-xl mb-1">
                          {item.title}
                        </p>
                        <p className="text-sm font-medium text-gray-500">
                          {item.desc}
                        </p>
                      </div>
                    </motion.button>
                  ))}
                </div>
                <button
                  onClick={() => setShowActionSheet(false)}
                  className="absolute top-8 right-8 p-2 text-gray-400 hover:text-gray-800 hover:bg-gray-100/50 rounded-full transition-colors z-10 md:block hidden"
                >
                  <X size={24} />
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* --- MODAL MANUAL INPUT BARU --- */}
        <AnimatePresence>
          {showManualInput && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex items-end md:items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4"
            >
              <div
                className="absolute inset-0"
                onClick={() => setShowManualInput(false)}
              ></div>
              <motion.div
                initial={{ y: "100%", scale: 0.95 }}
                animate={{ y: 0, scale: 1 }}
                exit={{ y: "100%", scale: 0.95 }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="w-full md:max-w-lg bg-white/80 backdrop-blur-[40px] border border-white/60 md:rounded-[3.5rem] rounded-t-[3.5rem] p-8 shadow-2xl relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-white/50 to-transparent pointer-events-none"></div>
                <div className="flex justify-between items-center mb-8 relative z-10">
                  <h3 className="text-3xl font-black text-gray-900 tracking-tight">
                    Catat Manual
                  </h3>
                  <button
                    onClick={() => setShowManualInput(false)}
                    className="w-12 h-12 bg-gray-100/50 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-200/50 transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>
                <div className="flex p-2 bg-gray-100/50 rounded-[1.5rem] mb-8 relative z-10 border border-gray-200/50">
                  <button
                    onClick={() =>
                      setManualData({ ...manualData, type: "expense" })
                    }
                    className={`flex-1 py-4 text-lg font-black rounded-2xl transition-all relative overflow-hidden ${manualData.type === "expense" ? "text-white shadow-lg" : "text-gray-500 hover:text-gray-800"}`}
                  >
                    {manualData.type === "expense" && (
                      <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-rose-500 -z-10"></div>
                    )}{" "}
                    Pengeluaran
                  </button>
                  <button
                    onClick={() =>
                      setManualData({ ...manualData, type: "income" })
                    }
                    className={`flex-1 py-4 text-lg font-black rounded-2xl transition-all relative overflow-hidden ${manualData.type === "income" ? "text-white shadow-lg" : "text-gray-500 hover:text-gray-800"}`}
                  >
                    {manualData.type === "income" && (
                      <div className="absolute inset-0 bg-gradient-to-r from-teal-500 to-blue-500 -z-10"></div>
                    )}{" "}
                    Pemasukan
                  </button>
                </div>
                <div className="space-y-6 relative z-10">
                  <div>
                    <label className="text-sm font-bold text-gray-500 ml-2 mb-2 block uppercase tracking-wider">
                      Nominal (Rp)
                    </label>
                    <input
                      type="number"
                      value={manualData.amount}
                      onChange={(e) =>
                        setManualData({ ...manualData, amount: e.target.value })
                      }
                      placeholder="0"
                      className="w-full p-6 bg-white/60 border border-white/60 rounded-[2rem] font-black text-3xl focus:ring-4 focus:ring-blue-500/20 outline-none shadow-sm focus:bg-white/80 transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-bold text-gray-500 ml-2 mb-2 block uppercase tracking-wider">
                      Keterangan
                    </label>
                    <input
                      type="text"
                      value={manualData.store}
                      onChange={(e) =>
                        setManualData({ ...manualData, store: e.target.value })
                      }
                      placeholder="Contoh: Bensin Motor"
                      className="w-full p-5 bg-white/60 border border-white/60 rounded-[2rem] font-bold text-xl focus:ring-4 focus:ring-blue-500/20 outline-none shadow-sm focus:bg-white/80 transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-bold text-gray-500 ml-2 mb-2 block uppercase tracking-wider">
                      Kategori
                    </label>
                    <div className="relative">
                      <select
                        value={manualData.category}
                        onChange={(e) =>
                          setManualData({
                            ...manualData,
                            category: e.target.value,
                          })
                        }
                        className="w-full p-5 bg-white/60 border border-white/60 rounded-[2rem] font-bold text-xl outline-none focus:ring-4 focus:ring-blue-500/20 shadow-sm appearance-none focus:bg-white/80 transition-all relative z-10"
                      >
                        {categories.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                      <ChevronRight
                        size={24}
                        className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-400 rotate-90 z-0 pointer-events-none"
                      />
                    </div>
                  </div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleSaveManual}
                  className="w-full mt-10 py-5 bg-gradient-to-r from-blue-600 to-teal-500 text-white rounded-[2rem] font-black text-xl shadow-xl shadow-blue-500/30 relative overflow-hidden group z-10"
                >
                  <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>{" "}
                  Simpan Transaksi
                </motion.button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* --- MODAL PREVIEW IMAGE BARU --- */}
        <AnimatePresence>
          {imagePreview && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-gray-900/60 backdrop-blur-md"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="w-full max-w-lg bg-white/80 backdrop-blur-[40px] border border-white/60 p-8 rounded-[3.5rem] shadow-2xl flex flex-col max-h-[90vh] relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-white/50 to-transparent pointer-events-none"></div>
                <div className="flex justify-between items-center mb-6 relative z-10">
                  <h3 className="text-3xl font-black text-gray-900 tracking-tight">
                    Konfirmasi Struk
                  </h3>
                  <button
                    onClick={() => setImagePreview(null)}
                    className="w-12 h-12 bg-gray-100/50 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-200/50 transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>
                <div className="flex-1 overflow-hidden rounded-[2.5rem] bg-gray-100/50 border border-white/50 relative mb-8 flex justify-center items-center min-h-[300px] shadow-inner z-10 p-2">
                  <img
                    src={imagePreview}
                    className="max-w-full max-h-[50vh] object-contain rounded-[2rem] shadow-sm"
                  />
                </div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleProcessAI}
                  className="w-full py-5 bg-gradient-to-r from-blue-600 via-violet-600 to-purple-600 text-white rounded-[2rem] font-black text-xl shadow-xl shadow-purple-500/30 relative overflow-hidden group z-10"
                  disabled={isProcessing}
                >
                  {isProcessing && (
                    <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                  )}
                  {isProcessing ? (
                    <span className="flex items-center justify-center gap-3">
                      <Sparkles className="animate-spin" /> Menganalisis...
                    </span>
                  ) : (
                    "Ekstrak Data Sekarang"
                  )}
                </motion.button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* --- MODAL DETAIL TRANSAKSI BARU --- */}
        <AnimatePresence>
          {selectedTransaction && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-gray-900/60 backdrop-blur-md"
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
                className="w-full max-w-lg bg-white/80 backdrop-blur-[40px] border border-white/60 rounded-[3.5rem] p-8 shadow-2xl relative flex flex-col max-h-[85vh] overflow-hidden"
              >
                <div
                  className={`absolute top-0 left-0 w-full h-48 bg-gradient-to-b ${selectedTransaction.type === "income" ? "from-teal-400/20" : "from-violet-400/20"} to-transparent pointer-events-none`}
                ></div>
                <div className="absolute top-8 right-8 flex gap-3 z-20">
                  {!isEditing && (
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleDelete(selectedTransaction.id)}
                      className="w-12 h-12 bg-red-50/80 text-red-500 rounded-full hover:bg-red-100/80 flex items-center justify-center shadow-sm backdrop-blur-md border border-red-100/50"
                    >
                      <Trash2 size={20} />
                    </motion.button>
                  )}
                  {!isEditing ? (
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={startEditing}
                      className="w-12 h-12 bg-blue-50/80 text-blue-600 rounded-full hover:bg-blue-100/80 flex items-center justify-center shadow-sm backdrop-blur-md border border-blue-100/50"
                    >
                      <Pencil size={20} />
                    </motion.button>
                  ) : (
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={saveEdit}
                      className="w-12 h-12 bg-gradient-to-r from-green-400 to-emerald-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-green-500/30"
                    >
                      <Check size={24} strokeWidth={3} />
                    </motion.button>
                  )}
                </div>
                <div className="text-center mb-8 mt-4 px-6 flex flex-col items-center relative z-10">
                  <div
                    className={`w-20 h-20 text-3xl rounded-[2rem] flex items-center justify-center mx-auto mb-4 shadow-lg ${selectedTransaction.type === "income" ? "bg-gradient-to-br from-teal-100 to-blue-100 text-teal-600 shadow-teal-500/20" : "bg-gradient-to-br from-violet-100 to-fuchsia-100 text-violet-600 shadow-violet-500/20"}`}
                  >
                    {isEditing ? editData.icon : selectedTransaction.icon}
                  </div>
                  {isEditing ? (
                    <div className="w-full space-y-4">
                      <input
                        type="text"
                        value={editData.store}
                        onChange={(e) =>
                          setEditData({ ...editData, store: e.target.value })
                        }
                        className="w-full text-center font-black text-2xl bg-white/60 border border-white/60 rounded-2xl p-3 outline-none focus:ring-4 focus:ring-blue-500/20 shadow-sm"
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
                        className="w-full text-center text-sm font-bold text-gray-600 bg-white/60 border border-white/60 rounded-2xl p-3 outline-none focus:ring-4 focus:ring-blue-500/20 shadow-sm"
                      />
                    </div>
                  ) : (
                    <>
                      <h3 className="font-black text-2xl text-gray-900 leading-tight w-full break-words px-2 mb-1">
                        {selectedTransaction.store}
                      </h3>
                      <p className="text-sm font-bold text-gray-400/80">
                        {selectedTransaction.date}
                      </p>
                    </>
                  )}
                </div>
                {selectedTransaction.items &&
                  selectedTransaction.items.length > 0 && (
                    <>
                      <div className="my-4 h-px w-full bg-gradient-to-r from-transparent via-gray-200 to-transparent shrink-0 relative z-10"></div>
                      <div className="flex-1 overflow-y-auto pr-2 space-y-4 no-scrollbar min-h-0 relative z-10 -mr-2 pl-2">
                        {isEditing
                          ? editData.items.map((item, index) => (
                              <div
                                key={index}
                                className="bg-white/60 p-4 rounded-[2rem] space-y-3 border border-white/60 relative pr-12 shadow-sm backdrop-blur-md"
                              >
                                <button
                                  onClick={() => handleDeleteItem(index)}
                                  className="absolute top-5 right-4 p-2 text-gray-300 hover:text-red-500 hover:bg-red-50/50 rounded-full transition-colors"
                                  title="Hapus"
                                >
                                  <Trash2 size={18} />
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
                                  className="w-full text-base font-bold text-gray-800 border border-gray-200/50 rounded-2xl p-3 outline-none focus:ring-2 focus:ring-blue-500/50 bg-white/80"
                                  placeholder="Nama barang"
                                />
                                <div className="relative">
                                  <select
                                    value={item.category || categories[7]}
                                    onChange={(e) =>
                                      handleItemChange(
                                        index,
                                        "category",
                                        e.target.value,
                                      )
                                    }
                                    className="w-full text-xs font-bold text-blue-600 border border-gray-200/50 rounded-2xl p-3 outline-none bg-white/80 focus:ring-2 focus:ring-blue-500/50 appearance-none relative z-10"
                                  >
                                    {categories.map((cat) => (
                                      <option key={cat} value={cat}>
                                        {cat}
                                      </option>
                                    ))}
                                  </select>
                                  <ChevronRight
                                    size={16}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-400 rotate-90 z-0 pointer-events-none"
                                  />
                                </div>
                                <div className="flex gap-3">
                                  <div className="relative w-24 shrink-0">
                                    <span className="absolute left-4 top-3 text-gray-400 text-xs font-bold">
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
                                      className="w-full pl-8 pr-3 py-3 text-sm font-bold border border-gray-200/50 rounded-2xl outline-none text-center bg-white/80 focus:ring-2 focus:ring-blue-500/50"
                                    />
                                  </div>
                                  <div className="relative flex-1 min-w-0">
                                    <span className="absolute left-4 top-3 text-gray-400 text-xs font-bold">
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
                                      className="w-full pl-10 pr-4 py-3 text-sm font-bold border border-gray-200/50 rounded-2xl outline-none bg-white/80 focus:ring-2 focus:ring-blue-500/50"
                                    />
                                  </div>
                                </div>
                              </div>
                            ))
                          : selectedTransaction.items?.map((item, index) => (
                              <div
                                key={index}
                                className="flex justify-between items-center p-3 hover:bg-white/40 rounded-2xl transition-colors border border-transparent hover:border-white/30"
                              >
                                <div className="flex-1 min-w-0 pr-4">
                                  <p className="font-bold text-gray-800 text-base break-words leading-tight mb-1">
                                    {item.name}
                                  </p>
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider border ${selectedTransaction.type === "income" ? "bg-teal-50/50 text-teal-600 border-teal-100/50" : "bg-violet-50/50 text-violet-600 border-violet-100/50"}`}
                                    >
                                      {item.category || "Lainnya"}
                                    </span>
                                    {Number(item.qty) > 1 && (
                                      <span className="text-xs font-bold text-gray-400">
                                        x{item.qty}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="font-black text-gray-900 text-lg whitespace-nowrap">
                                    Rp{" "}
                                    {(
                                      (Number(item.qty) || 1) *
                                      (Number(item.price) || 0)
                                    ).toLocaleString("id-ID")}
                                  </p>
                                  {Number(item.qty) > 1 && (
                                    <p className="text-[11px] font-semibold text-gray-400 whitespace-nowrap mt-0.5">
                                      @ Rp{" "}
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
                <div className="my-6 h-px w-full bg-gradient-to-r from-transparent via-gray-300 to-transparent shrink-0 relative z-10"></div>
                <div className="flex justify-between items-end mt-2 shrink-0 gap-4 relative z-10 bg-white/40 p-5 rounded-[2.5rem] border border-white/60 shadow-sm backdrop-blur-md">
                  <div>
                    <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">
                      Total Transaksi
                    </p>
                  </div>
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
                      className={`text-3xl font-black bg-transparent border-b-2 border-gray-200 w-48 min-w-0 text-right outline-none focus:border-blue-500 pb-1 ${editData.type === "income" ? "text-teal-600 border-teal-200 focus:border-teal-500" : "text-violet-600 border-violet-200 focus:border-violet-500"}`}
                    />
                  ) : (
                    <span
                      className={`text-4xl font-black shrink-0 whitespace-nowrap bg-clip-text text-transparent ${selectedTransaction.type === "income" ? "bg-gradient-to-r from-teal-500 to-blue-600" : "bg-gradient-to-r from-violet-500 to-fuchsia-600"}`}
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
                  className={`w-full mt-8 py-5 rounded-[2rem] font-black text-lg transition-colors shrink-0 shadow-xl relative z-10 ${isEditing ? "bg-red-50/80 text-red-600 hover:bg-red-100/80 border border-red-100/50" : "bg-white/80 text-gray-800 hover:bg-white/90 border border-white/60"}`}
                >
                  {isEditing ? "Batalkan Perubahan" : "Tutup Detail"}
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
