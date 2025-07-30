const app = new Framework7({
  // App root element
  el: '#app',
  // App Name
  name: 'Mes frais',
  // App default theme
  theme: 'auto',
  // Add default routes
  routes: [],
  // ... other parameters
});

document.getElementById('photo-btn').addEventListener('click', () => {
  document.getElementById('photo-input').click();
});

document.getElementById('photo-input').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async () => {
    const img = new Image();
    img.src = reader.result;
    img.onload = async () => {
      document.getElementById('preview-container').innerHTML = `<div style="background-image:url(${img.src})" valign="bottom"/>`;

      const result = await Tesseract.recognize(img, 'fra');
      const text = result.data.text;
      console.log("Texte OCR :", text);

      const match = text.match(/(?:total\s*(?:ttc)?|montant\s*(?:à\s*payer)?)[^\d]{0,10}([\d\s,.]+)/i);
      const montant = match ? match[1].trim() : null;
      if (montant) {
        app.dialog.alert(`Montant TTC détecté : ${montant}`, 'OCR réussi');
      } else {
        app.dialog.alert('Aucun montant TTC détecté', 'OCR échoué');
      }
    };
  };
  reader.readAsDataURL(file);
});
