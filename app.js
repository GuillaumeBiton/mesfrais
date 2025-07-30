const app = new Framework7({
  // App root element
  el: '#app',
  // App Name
  name: 'Mes frais',
  // App default theme
  theme: auto,
  // Add default routes
  routes: [],
  // ... other parameters
});

document.getElementById('photo-btn').addEventListener('click', () => {
  document.getElementById('photo-input').click();
});
