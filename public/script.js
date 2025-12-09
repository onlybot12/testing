let keranjang = [];
let produkList = [];

// Format Rupiah
function formatRupiah(angka) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(angka);
}

// Format Tanggal
function formatTanggal(tanggal) {
  const date = new Date(tanggal);
  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// ========== NAVIGASI ==========
function showPage(pageName) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  
  document.getElementById(`page-${pageName}`).classList.add('active');
  event.target.classList.add('active');
  
  if (pageName === 'produk') {
    loadProdukTable();
  } else if (pageName === 'laporan') {
    setDefaultDates();
    loadLaporan();
  } else if (pageName === 'kasir') {
    loadProduk();
  }
}

// ========== KASIR ==========

// Load produk untuk kasir
async function loadProduk() {
  try {
    const response = await fetch('/api/produk');
    produkList = await response.json();
    
    const container = document.getElementById('daftar-produk');
    container.innerHTML = '';
    
    produkList.forEach(item => {
      const div = document.createElement('button');
      div.className = `produk-item ${item.stok <= 0 ? 'stok-habis' : ''}`;
      div.disabled = item.stok <= 0;
      div.innerHTML = `
        <div class="produk-nama">${item.nama}</div>
        <div class="produk-harga">${formatRupiah(item.hargaJual)}</div>
        <div class="produk-stok">Stok: ${item.stok}</div>
      `;
      if (item.stok > 0) {
        div.onclick = () => tambahKeKeranjang(item);
      }
      container.appendChild(div);
    });
  } catch (error) {
    console.error('Error loading produk:', error);
  }
}

// Tambah ke keranjang
function tambahKeKeranjang(produk) {
  const itemAda = keranjang.find(item => item.id === produk._id);
  
  if (itemAda) {
    if (itemAda.qty < produk.stok) {
      itemAda.qty++;
    } else {
      alert('Stok tidak cukup!');
      return;
    }
  } else {
    keranjang.push({
      id: produk._id,
      nama: produk.nama,
      hargaBeli: produk.hargaBeli,
      hargaJual: produk.hargaJual,
      qty: 1
    });
  }
  
  updateKeranjang();
}

// Update tampilan keranjang
function updateKeranjang() {
  const container = document.getElementById('keranjang');
  const pembayaranSection = document.getElementById('pembayaran');
  
  if (keranjang.length === 0) {
    container.innerHTML = '<p class="empty-message">Keranjang masih kosong</p>';
    pembayaranSection.style.display = 'none';
    return;
  }
  
  container.innerHTML = '';
  pembayaranSection.style.display = 'block';
  
  keranjang.forEach(item => {
    const div = document.createElement('div');
    div.className = 'keranjang-item';
    div.innerHTML = `
      <div class="item-info">
        <div class="item-nama">${item.nama}</div>
        <div class="item-detail">${formatRupiah(item.hargaJual)} x ${item.qty}</div>
      </div>
      <div class="item-controls">
        <button class="btn-qty" onclick="kurangiQty('${item.id}')">-</button>
        <span class="qty-display">${item.qty}</span>
        <button class="btn-qty" onclick="tambahQty('${item.id}')">+</button>
        <button class="btn-hapus" onclick="hapusDariKeranjang('${item.id}')">Hapus</button>
      </div>
      <div class="item-subtotal">${formatRupiah(item.hargaJual * item.qty)}</div>
    `;
    container.appendChild(div);
  });
  
  updateTotal();
}

// Tambah qty
function tambahQty(id) {
  const item = keranjang.find(item => item.id === id);
  const produk = produkList.find(p => p._id === id);
  
  if (item && produk && item.qty < produk.stok) {
    item.qty++;
    updateKeranjang();
  } else {
    alert('Stok tidak cukup!');
  }
}

// Kurangi qty
function kurangiQty(id) {
  const item = keranjang.find(item => item.id === id);
  if (item) {
    if (item.qty === 1) {
      hapusDariKeranjang(id);
    } else {
      item.qty--;
      updateKeranjang();
    }
  }
}

// Hapus dari keranjang
function hapusDariKeranjang(id) {
  keranjang = keranjang.filter(item => item.id !== id);
  updateKeranjang();
}

// Update total
function updateTotal() {
  const total = keranjang.reduce((sum, item) => sum + (item.hargaJual * item.qty), 0);
  const keuntungan = keranjang.reduce((sum, item) => {
    return sum + ((item.hargaJual - item.hargaBeli) * item.qty);
  }, 0);
  
  document.getElementById('total-harga').textContent = formatRupiah(total);
  document.getElementById('total-keuntungan').textContent = formatRupiah(keuntungan);
}

// Input uang bayar
document.getElementById('uang-bayar').addEventListener('input', function() {
  const total = keranjang.reduce((sum, item) => sum + (item.hargaJual * item.qty), 0);
  const bayar = parseInt(this.value) || 0;
  const kembalian = bayar - total;
  
  const kembalianSection = document.getElementById('kembalian-section');
  const errorSection = document.getElementById('error-section');
  
  if (bayar >= total && bayar > 0) {
    kembalianSection.style.display = 'block';
    errorSection.style.display = 'none';
    document.getElementById('kembalian').textContent = formatRupiah(kembalian);
  } else if (bayar > 0) {
    kembalianSection.style.display = 'none';
    errorSection.style.display = 'block';
    document.getElementById('error-message').textContent = 
      `Uang tidak cukup! Kurang: ${formatRupiah(total - bayar)}`;
  } else {
    kembalianSection.style.display = 'none';
    errorSection.style.display = 'none';
  }
});

// Selesai transaksi
document.getElementById('btn-selesai').addEventListener('click', async function() {
  const total = keranjang.reduce((sum, item) => sum + (item.hargaJual * item.qty), 0);
  const bayar = parseInt(document.getElementById('uang-bayar').value) || 0;
  
  if (bayar < total) {
    alert('Uang pembayaran tidak cukup!');
    return;
  }
  
  const kembalian = bayar - total;
  const keuntungan = keranjang.reduce((sum, item) => {
    return sum + ((item.hargaJual - item.hargaBeli) * item.qty);
  }, 0);
  
  try {
    const response = await fetch('/api/transaksi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: keranjang,
        total,
        bayar,
        kembalian
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      alert(`Transaksi berhasil!\nTotal: ${formatRupiah(total)}\nKeuntungan: ${formatRupiah(keuntungan)}\nBayar: ${formatRupiah(bayar)}\nKembalian: ${formatRupiah(kembalian)}`);
      resetTransaksi();
      loadProduk(); // Refresh stok
    }
  } catch (error) {
    console.error('Error:', error);
    alert('Terjadi kesalahan saat menyimpan transaksi');
  }
});

// Reset transaksi
document.getElementById('btn-reset').addEventListener('click', resetTransaksi);

function resetTransaksi() {
  keranjang = [];
  document.getElementById('uang-bayar').value = '';
  document.getElementById('kembalian-section').style.display = 'none';
  document.getElementById('error-section').style.display = 'none';
  updateKeranjang();
}

// ========== KELOLA PRODUK ==========

// Form submit produk
document.getElementById('form-produk').addEventListener('submit', async function(e) {
  e.preventDefault();
  
  const produk = {
    nama: document.getElementById('nama-produk').value,
    hargaBeli: parseInt(document.getElementById('harga-beli').value),
    hargaJual: parseInt(document.getElementById('harga-jual').value),
    stok: parseInt(document.getElementById('stok-produk').value)
  };
  
  try {
    const response = await fetch('/api/produk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(produk)
    });
    
    const result = await response.json();
    
    if (result.success) {
      alert('Produk berhasil ditambahkan!');
      this.reset();
      loadProdukTable();
    }
  } catch (error) {
    console.error('Error:', error);
    alert('Terjadi kesalahan');
  }
});

// Load tabel produk
async function loadProdukTable() {
  try {
    const response = await fetch('/api/produk');
    const produk = await response.json();
    
    const tbody = document.querySelector('#tabel-produk tbody');
    tbody.innerHTML = '';
    
    produk.forEach(item => {
      const margin = ((item.hargaJual - item.hargaBeli) / item.hargaJual * 100).toFixed(1);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${item.nama}</td>
        <td>${formatRupiah(item.hargaBeli)}</td>
        <td>${formatRupiah(item.hargaJual)}</td>
        <td><span class="margin-badge">${margin}%</span></td>
        <td>${item.stok}</td>
        <td>
          <button class="btn-danger" onclick="hapusProduk('${item._id}')">Hapus</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (error) {
    console.error('Error:', error);
  }
}

// Hapus produk
async function hapusProduk(id) {
  if (!confirm('Yakin ingin menghapus produk ini?')) return;
  
  try {
    await fetch(`/api/produk/${id}`, { method: 'DELETE' });
    loadProdukTable();
  } catch (error) {
    console.error('Error:', error);
  }
}

// ========== LAPORAN ==========

// Set default dates
function setDefaultDates() {
  const today = new Date();
  const sebulanLalu = new Date();
  sebulanLalu.setMonth(today.getMonth() - 1);
  
  document.getElementById('dari-tanggal').value = sebulanLalu.toISOString().split('T')[0];
  document.getElementById('sampai-tanggal').value = today.toISOString().split('T')[0];
}

// Load laporan
async function loadLaporan() {
  const dari = document.getElementById('dari-tanggal').value;
  const sampai = document.getElementById('sampai-tanggal').value;
  
  try {
    const response = await fetch(`/api/laporan/periode?dari=${dari}&sampai=${sampai}`);
    const data = await response.json();
    
    // Update statistik
    document.getElementById('stat-penjualan').textContent = formatRupiah(data.totalPenjualan);
    document.getElementById('stat-modal').textContent = formatRupiah(data.totalModal);
    document.getElementById('stat-keuntungan').textContent = formatRupiah(data.totalKeuntungan);
    document.getElementById('stat-margin').textContent = data.marginKeuntungan + '%';
    
    // Produk terlaris
    const tabelTerlaris = document.querySelector('#tabel-terlaris tbody');
    tabelTerlaris.innerHTML = '';
    
    data.produkTerlaris.forEach(item => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${item.nama}</td>
        <td>${item.qty}</td>
        <td>${formatRupiah(item.total)}</td>
      `;
      tabelTerlaris.appendChild(tr);
    });
    
    // Riwayat transaksi
    const tabelTransaksi = document.querySelector('#tabel-transaksi tbody');
    tabelTransaksi.innerHTML = '';
    
    data.transaksi.forEach(t => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${formatTanggal(t.tanggal)}</td>
        <td>${formatRupiah(t.total)}</td>
        <td>${formatRupiah(t.totalKeuntungan)}</td>
        <td><button class="btn-primary" onclick="lihatDetail('${t._id}')">Detail</button></td>
      `;
      tabelTransaksi.appendChild(tr);
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Lihat detail transaksi
function lihatDetail(id) {
  alert('Fitur detail transaksi akan ditampilkan di sini');
}

// Load produk saat halaman dimuat
loadProduk();
