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

let cropper;
const popup = app.popup.create({ el: '#crop-popup' });

document.getElementById('photo-input').addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file || !file.type.match(/^image\\/(jpeg|png)/)) {
    app.dialog.alert("Format non pris en charge. JPEG ou PNG uniquement.");
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const img = document.getElementById('crop-image');
    img.src = reader.result;

    img.onload = () => {
      if (cropper) cropper.destroy(); // détruire l’ancien si nécessaire
      cropper = new Cropper(img, {
        aspectRatio: NaN, // libre
        viewMode: 1,
      });
      popup.open(); // ouvrir le popup de recadrage
    };
  };
  reader.readAsDataURL(file);
});

document.getElementById('validate-crop').addEventListener('click', async () => {
  const canvas = cropper.getCroppedCanvas();
  popup.close();
  cropper.destroy();

  const imagePreview = document.getElementById('preview-container');
  imagePreview.innerHTML = `<img src="${canvas.toDataURL()}" style="max-width: 100%; margin-top: 1rem;" />`;

  app.dialog.preloader('Analyse de l’image...');
  try {
    const result = await Tesseract.recognize(canvas.toDataURL(), 'fra');
    app.dialog.close();

    const text = result.data.text;
    console.log("Texte OCR :", text);
    const match = text.match(/(?:total\\s*(?:ttc)?|montant\\s*(?:à\\s*payer)?)[^\\d]{0,10}([\\d\\s,.]+)/i);
    const montant = match ? match[1].trim() : null;

    if (montant) {
      app.dialog.alert(`Montant TTC détecté : ${montant}`, 'OCR réussi');
    } else {
      app.dialog.alert('Aucun montant TTC détecté', 'OCR échoué');
    }
  } catch (err) {
    app.dialog.close();
    console.error("Erreur OCR :", err);
    app.dialog.alert("Erreur lors de l’analyse OCR.", "Erreur");
  }
});

document.getElementById('photo-btn').addEventListener('click', () => {
  document.getElementById('photo-input').click();
});
