// Create the script tag, set the appropriate attributes
const script = document.createElement('script');
script.src = 'https://maps.googleapis.com/maps/api/js?key=AIzaSyCYZ3Lh7jBsntbLSL31QqVtC3RVyYEHr9w&callback=initMap&libraries=places&loading=async';
script.defer = true;

// Attach your callback function to the `window` object
window.initMap = () => {
  // JS API is loaded and available
  console.log('map loaded');
};

// Append the 'script' element to 'head'
document.head.appendChild(script);
