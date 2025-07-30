var app = new Framework7({
  // App root element
  el: '#app',
  // App Name
  name: 'My App',
  // Enable swipe panel
  panel: {
    swipe: true,
  },
  // Add default routes
  routes: [
    {
      path: '/about/',
      url: 'about.html',
    },
  ],
  // ... other parameters
});
