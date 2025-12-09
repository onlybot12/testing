const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static('public'));

// Koneksi MongoDB
mongoose.connect('mongodb+srv://Maulanaa:5q1PrEZUUJkY4ioF@cluster0.rgcpg7g.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB terhubung'))
.catch(err => console.error('MongoDB error:', err));

// Schema Produk
const produkSchema = new mongoose.Schema({
  nama: { type: String, required: true },
  hargaBeli: { type: Number, required: true },
  hargaJual: { type: Number, required: true },
  stok: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

// Schema Transaksi
const transaksiSchema = new mongoose.Schema({
  items: [{
    produkId: mongoose.Schema.Types.ObjectId,
    nama: String,
    hargaBeli: Number,
    hargaJual: Number,
    qty: Number,
    subtotal: Number,
    keuntungan: Number
  }],
  total: { type: Number, required: true },
  totalKeuntungan: { type: Number, required: true },
  bayar: { type: Number, required: true },
  kembalian: { type: Number, required: true },
  tanggal: { type: Date, default: Date.now }
});

const Produk = mongoose.model('Produk', produkSchema);
const Transaksi = mongoose.model('Transaksi', transaksiSchema);

// ========== API PRODUK ==========
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"))
})

// Get semua produk
app.get('/api/produk', async (req, res) => {
  try {
    const produk = await Produk.find();
    res.json(produk);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Tambah produk baru
app.post('/api/produk', async (req, res) => {
  try {
    const produkBaru = new Produk(req.body);
    await produkBaru.save();
    res.json({ success: true, produk: produkBaru });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update produk
app.put('/api/produk/:id', async (req, res) => {
  try {
    const produk = await Produk.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, produk });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Hapus produk
app.delete('/api/produk/:id', async (req, res) => {
  try {
    await Produk.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== API TRANSAKSI ==========

// Simpan transaksi
app.post('/api/transaksi', async (req, res) => {
  try {
    const { items, total, bayar, kembalian } = req.body;
    
    // Hitung total keuntungan
    const totalKeuntungan = items.reduce((sum, item) => {
      return sum + ((item.hargaJual - item.hargaBeli) * item.qty);
    }, 0);
    
    // Simpan transaksi
    const transaksi = new Transaksi({
      items: items.map(item => ({
        produkId: item.id,
        nama: item.nama,
        hargaBeli: item.hargaBeli,
        hargaJual: item.hargaJual,
        qty: item.qty,
        subtotal: item.hargaJual * item.qty,
        keuntungan: (item.hargaJual - item.hargaBeli) * item.qty
      })),
      total,
      totalKeuntungan,
      bayar,
      kembalian
    });
    
    await transaksi.save();
    
    // Update stok produk
    for (const item of items) {
      await Produk.findByIdAndUpdate(item.id, {
        $inc: { stok: -item.qty }
      });
    }
    
    res.json({ success: true, transaksi });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get semua transaksi
app.get('/api/transaksi', async (req, res) => {
  try {
    const transaksi = await Transaksi.find().sort({ tanggal: -1 });
    res.json(transaksi);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== API LAPORAN ==========

// Laporan harian
app.get('/api/laporan/harian', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const transaksi = await Transaksi.find({
      tanggal: { $gte: today }
    });
    
    const totalPenjualan = transaksi.reduce((sum, t) => sum + t.total, 0);
    const totalKeuntungan = transaksi.reduce((sum, t) => sum + t.totalKeuntungan, 0);
    const jumlahTransaksi = transaksi.length;
    
    res.json({
      tanggal: today,
      jumlahTransaksi,
      totalPenjualan,
      totalKeuntungan,
      transaksi
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Laporan periode
app.get('/api/laporan/periode', async (req, res) => {
  try {
    const { dari, sampai } = req.query;
    
    const transaksi = await Transaksi.find({
      tanggal: {
        $gte: new Date(dari),
        $lte: new Date(sampai)
      }
    });
    
    const totalPenjualan = transaksi.reduce((sum, t) => sum + t.total, 0);
    const totalKeuntungan = transaksi.reduce((sum, t) => sum + t.totalKeuntungan, 0);
    const totalModal = transaksi.reduce((sum, t) => {
      return sum + t.items.reduce((s, item) => s + (item.hargaBeli * item.qty), 0);
    }, 0);
    
    // Produk terlaris
    const produkMap = {};
    transaksi.forEach(t => {
      t.items.forEach(item => {
        if (!produkMap[item.nama]) {
          produkMap[item.nama] = { nama: item.nama, qty: 0, total: 0 };
        }
        produkMap[item.nama].qty += item.qty;
        produkMap[item.nama].total += item.subtotal;
      });
    });
    
    const produkTerlaris = Object.values(produkMap)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
    
    res.json({
      periode: { dari, sampai },
      jumlahTransaksi: transaksi.length,
      totalPenjualan,
      totalModal,
      totalKeuntungan,
      marginKeuntungan: totalPenjualan > 0 ? (totalKeuntungan / totalPenjualan * 100).toFixed(2) : 0,
      produkTerlaris,
      transaksi
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Statistik produk
app.get('/api/laporan/produk', async (req, res) => {
  try {
    const transaksi = await Transaksi.find();
    const produk = await Produk.find();
    
    const statistik = produk.map(p => {
      let terjual = 0;
      let pendapatan = 0;
      let keuntungan = 0;
      
      transaksi.forEach(t => {
        t.items.forEach(item => {
          if (item.produkId.toString() === p._id.toString()) {
            terjual += item.qty;
            pendapatan += item.subtotal;
            keuntungan += item.keuntungan;
          }
        });
      });
      
      return {
        nama: p.nama,
        hargaBeli: p.hargaBeli,
        hargaJual: p.hargaJual,
        stok: p.stok,
        terjual,
        pendapatan,
        keuntungan,
        marginKeuntungan: p.hargaJual > 0 ? ((p.hargaJual - p.hargaBeli) / p.hargaJual * 100).toFixed(2) : 0
      };
    });
    
    res.json(statistik);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});
