/*
 * Client-side JavaScript for The Cozy Nook bakery website.
 *
 * This script manages:
 *   - Authentication status and navigation link rendering
 *   - Fetching and displaying products on the home page
 *   - Handling login and registration forms
 *   - Managing a client-side shopping cart
 *   - Submitting orders to the server
 *   - Admin interface for product management
 */

// Polyfill for crypto.randomUUID for older browsers or undefined crypto
if (typeof window.crypto === 'undefined') {
  window.crypto = {};
}
if (typeof window.crypto.randomUUID !== 'function') {
  window.crypto.randomUUID = function () {
    return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };
}

// Ensure a global crypto reference for convenience
const crypto = window.crypto;

// -----------------------------------------------------------------------------
// Client‑side data management using localStorage
//
// In environments where a backend is not available or cannot be run, we store
// all application state directly in the browser. This includes users, the
// product catalog, and the currently logged in user. Note that this data is
// only available on the current device and browser and will not persist across
// different machines.

function getUsers() {
  return JSON.parse(localStorage.getItem('users') || '[]');
}

function saveUsers(users) {
  localStorage.setItem('users', JSON.stringify(users));
}

function getProducts() {
  const products = JSON.parse(localStorage.getItem('products') || 'null');
  if (products) {
    // migrate any old image paths from earlier versions
    let updated = false;
    products.forEach(p => {
      if (typeof p.image === 'string' && p.image.startsWith('/public/images/')) {
        p.image = p.image.replace('/public/images/', 'images/');
        updated = true;
      }
    });
    if (updated) saveProducts(products);
    return products;
  }
  // Default products if none exist
  const defaultProducts = [
    {
      id: crypto.randomUUID(),
      name: 'Chocolate Chip Cookies',
      description: 'Classic cookies with rich chocolate chips.',
      price: 3.0,
      quantity: 30,
      image: 'images/cookies.jpg'
    },
    {
      id: crypto.randomUUID(),
      name: 'Cinnamon Rolls',
      description: 'Soft rolls swirled with cinnamon and topped with icing.',
      price: 4.5,
      quantity: 20,
      image: 'images/cinnamon_rolls.jpg'
    },
    {
      id: crypto.randomUUID(),
      name: 'Blueberry Muffins',
      description: 'Moist muffins bursting with fresh blueberries.',
      price: 3.5,
      quantity: 25,
      image: 'images/muffins.jpg'
    }
  ];
  saveProducts(defaultProducts);
  return defaultProducts;
}

function saveProducts(products) {
  localStorage.setItem('products', JSON.stringify(products));
}

function getCurrentUser() {
  return JSON.parse(localStorage.getItem('currentUser') || 'null');
}

function setCurrentUser(user) {
  if (user) {
    localStorage.setItem('currentUser', JSON.stringify(user));
  } else {
    localStorage.removeItem('currentUser');
  }
}

function logoutUser() {
  setCurrentUser(null);
}

function ensureAdminUser() {
  const users = getUsers();
  if (!users.some(u => u.username === 'admin')) {
    users.push({ id: crypto.randomUUID(), username: 'admin', password: 'admin', isAdmin: true });
    saveUsers(users);
  }
}

function registerUser(username, password) {
  const users = getUsers();
  if (users.some(u => u.username === username)) {
    throw new Error('Username already exists');
  }
  const user = { id: crypto.randomUUID(), username, password, isAdmin: false };
  users.push(user);
  saveUsers(users);
  setCurrentUser({ username: user.username, isAdmin: user.isAdmin });
}

function loginUser(username, password) {
  const user = getUsers().find(u => u.username === username && u.password === password);
  if (!user) {
    throw new Error('Invalid credentials');
  }
  setCurrentUser({ username: user.username, isAdmin: user.isAdmin });
}

// Render navigation links based on auth state
async function renderNav() {
  const nav = document.getElementById('nav-links');
  if (!nav) return;
  nav.innerHTML = '';
  const user = getCurrentUser();
  const links = [];
  links.push({ href: 'index.html', text: 'Home' });
  links.push({ href: 'cart.html', text: 'Cart' });
  if (user && user.isAdmin) {
    links.push({ href: 'admin.html', text: 'Admin' });
  }
  if (user) {
    links.push({ href: '#', text: `Hi, ${user.username}`, disabled: true });
    links.push({ href: '#', text: 'Logout', id: 'logout-link' });
  } else {
    links.push({ href: 'login.html', text: 'Login' });
    links.push({ href: 'register.html', text: 'Register' });
  }
  links.forEach(link => {
    const a = document.createElement('a');
    a.textContent = link.text;
    if (link.href) a.href = link.href;
    if (link.id) a.id = link.id;
    if (link.disabled) {
      a.style.pointerEvents = 'none';
      a.style.opacity = '0.6';
    }
    nav.appendChild(a);
  });
  // Attach logout handler
  const logoutLink = document.getElementById('logout-link');
  if (logoutLink) {
    logoutLink.addEventListener('click', async e => {
      e.preventDefault();
      logoutUser();
      localStorage.removeItem('cart');
      window.location.href = 'index.html';
    });
  }
}

// Load products on home page
async function loadProducts() {
  const container = document.getElementById('products-container');
  if (!container) return;
  const products = getProducts();
  container.innerHTML = '';
  products.forEach(prod => {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
      <img src="${prod.image}" alt="${prod.name}" />
      <div class="content">
        <h3>${prod.name}</h3>
        <p class="description">${prod.description}</p>
        <div class="price">$${prod.price.toFixed(2)}</div>
        <div class="quantity">Available: ${prod.quantity}</div>
        <button data-id="${prod.id}" ${prod.quantity === 0 ? 'disabled' : ''}>Add to Cart</button>
      </div>
    `;
    container.appendChild(card);
  });
  // Bind add to cart buttons
  container.querySelectorAll('button[data-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const user = getCurrentUser();
      if (!user) {
        window.location.href = 'login.html';
        return;
      }
      const id = btn.getAttribute('data-id');
      addToCart(id);
    });
  });
}

// Cart functions
function getCart() {
  return JSON.parse(localStorage.getItem('cart') || '[]');
}

function saveCart(cart) {
  localStorage.setItem('cart', JSON.stringify(cart));
}

function addToCart(productId) {
  const cart = getCart();
  const item = cart.find(i => i.productId === productId);
  if (item) {
    item.quantity += 1;
  } else {
    cart.push({ productId, quantity: 1 });
  }
  saveCart(cart);
  alert('Added to cart!');
}

// Load cart page
async function loadCartPage() {
  const container = document.getElementById('cart-container');
  if (!container) return;
  const cart = getCart();
  const products = getProducts();
  container.innerHTML = '<h2>Your Cart</h2>';
  if (cart.length === 0) {
    const p = document.createElement('p');
    p.textContent = 'Your cart is empty.';
    container.appendChild(p);
    return;
  }
  let total = 0;
  cart.forEach(item => {
    const prod = products.find(p => p.id === item.productId);
    if (!prod) return;
    const itemTotal = prod.price * item.quantity;
    total += itemTotal;
    const div = document.createElement('div');
    div.className = 'cart-item';
    div.innerHTML = `
      <img src="${prod.image}" alt="${prod.name}" />
      <div class="details">
        <h4>${prod.name}</h4>
        <span>$${prod.price.toFixed(2)} each</span>
      </div>
      <div class="quantity">
        <button class="dec">-</button>
        <span>${item.quantity}</span>
        <button class="inc">+</button>
      </div>
      <div class="item-total">$${itemTotal.toFixed(2)}</div>
      <button class="remove">Remove</button>
    `;
    // Bind events
    const decBtn = div.querySelector('button.dec');
    const incBtn = div.querySelector('button.inc');
    const removeBtn = div.querySelector('button.remove');
    decBtn.addEventListener('click', () => {
      if (item.quantity > 1) {
        item.quantity -= 1;
        saveCart(cart);
        loadCartPage();
      }
    });
    incBtn.addEventListener('click', () => {
      item.quantity += 1;
      saveCart(cart);
      loadCartPage();
    });
    removeBtn.addEventListener('click', () => {
      const idx = cart.findIndex(i => i.productId === item.productId);
      if (idx >= 0) {
        cart.splice(idx, 1);
        saveCart(cart);
        loadCartPage();
      }
    });
    container.appendChild(div);
  });
  const totalDiv = document.createElement('div');
  totalDiv.className = 'cart-total';
  totalDiv.textContent = `Total: $${total.toFixed(2)}`;
  container.appendChild(totalDiv);
  const checkoutBtn = document.createElement('button');
  checkoutBtn.className = 'checkout-btn';
  checkoutBtn.textContent = 'Checkout';
  checkoutBtn.addEventListener('click', async () => {
    const user = getCurrentUser();
    if (!user) {
      window.location.href = 'login.html';
      return;
    }
    // Reduce inventory quantities
    const productsList = getProducts();
    let valid = true;
    cart.forEach(item => {
      const prod = productsList.find(p => p.id === item.productId);
      if (!prod || item.quantity > prod.quantity) {
        valid = false;
      }
    });
    if (!valid) {
      alert('One or more items are not available in the requested quantity.');
      return;
    }
    cart.forEach(item => {
      const prod = productsList.find(p => p.id === item.productId);
      if (prod) {
        prod.quantity -= item.quantity;
      }
    });
    saveProducts(productsList);
    alert('Your order has been placed!');
    localStorage.removeItem('cart');
    window.location.href = 'index.html';
  });
  container.appendChild(checkoutBtn);
}

// Load admin page
async function loadAdminPage() {
  const tableBody = document.querySelector('#admin-products-table tbody');
  if (!tableBody) return;
  // check user
  const user = getCurrentUser();
  if (!user || !user.isAdmin) {
    window.location.href = 'index.html';
    return;
  }
  const products = getProducts();
  tableBody.innerHTML = '';
  products.forEach((prod, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><img src="${prod.image}" alt="${prod.name}" /></td>
      <td>${prod.name}</td>
      <td>${prod.description}</td>
      <td>$${prod.price.toFixed(2)}</td>
      <td>${prod.quantity}</td>
      <td>
        <div class="admin-controls">
          <button class="edit">Edit</button>
          <button class="delete">Delete</button>
        </div>
      </td>
    `;
    // Attach delete handler
    tr.querySelector('button.delete').addEventListener('click', () => {
      if (confirm('Delete this product?')) {
        products.splice(index, 1);
        saveProducts(products);
        loadAdminPage();
      }
    });
    // Attach edit handler
    tr.querySelector('button.edit').addEventListener('click', () => {
      const newName = prompt('Product name:', prod.name);
      if (newName === null) return;
      const newDesc = prompt('Description:', prod.description);
      if (newDesc === null) return;
      const newPrice = prompt('Price:', prod.price);
      if (newPrice === null) return;
      const newQty = prompt('Quantity:', prod.quantity);
      if (newQty === null) return;
      const newImage = prompt('Image path:', prod.image);
      if (newImage === null) return;
      prod.name = newName;
      prod.description = newDesc;
      prod.price = parseFloat(newPrice);
      prod.quantity = parseInt(newQty, 10);
      prod.image = newImage;
      saveProducts(products);
      loadAdminPage();
    });
    tableBody.appendChild(tr);
  });
  // Add product form
  const addForm = document.getElementById('add-product-form');
  if (addForm) {
    addForm.addEventListener('submit', e => {
      e.preventDefault();
      const name = document.getElementById('product-name').value.trim();
      const description = document.getElementById('product-description').value.trim();
      const price = document.getElementById('product-price').value;
      const quantity = document.getElementById('product-quantity').value;
      const image = document.getElementById('product-image').value.trim() || 'images/placeholder.jpg';
      const errorEl = document.getElementById('admin-error');
      errorEl.textContent = '';
      if (!name || !price || quantity === '') {
        errorEl.textContent = 'Name, price, and quantity are required.';
        return;
      }
      products.push({ id: crypto.randomUUID(), name, description, price: parseFloat(price), quantity: parseInt(quantity, 10), image });
      saveProducts(products);
      addForm.reset();
      loadAdminPage();
    });
  }
}

// Handle login form
function initLoginForm() {
  const form = document.getElementById('login-form');
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('login-error');
    errorEl.textContent = '';
    try {
      loginUser(username, password);
      window.location.href = 'index.html';
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });
}

// Handle register form
function initRegisterForm() {
  const form = document.getElementById('register-form');
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('register-error');
    errorEl.textContent = '';
    if (!username || !password) {
      errorEl.textContent = 'Please provide username and password.';
      return;
    }
    try {
      registerUser(username, password);
      window.location.href = 'index.html';
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });
}

// Set footer year
function setFooterYear() {
  const yearEl = document.getElementById('year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }
}

// Initialize page based on current path
function init() {
  renderNav();
  setFooterYear();
  // Ensure default admin user and products exist
  ensureAdminUser();
  getProducts();
  // Determine which page to initialize by inspecting the presence of
  // specific elements. This approach works both for file:// URLs and
  // server‑served paths.
  if (document.getElementById('products-container')) {
    loadProducts();
  }
  if (document.getElementById('login-form')) {
    initLoginForm();
  }
  if (document.getElementById('register-form')) {
    initRegisterForm();
  }
  if (document.getElementById('cart-container')) {
    loadCartPage();
  }
  if (document.querySelector('#admin-products-table')) {
    loadAdminPage();
  }
}

document.addEventListener('DOMContentLoaded', init);