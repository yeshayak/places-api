// Create the script tag, set the appropriate attributes
var script = document.createElement('script')
script.src = 'https://maps.googleapis.com/maps/api/js?key=AIzaSyCYZ3Lh7jBsntbLSL31QqVtC3RVyYEHr9w&loading=async&libraries=places&callback=initMap'
script.defer = true

// Attach your callback function to the `window` object
window.initMap = function () {
  // JS API is loaded and available

  console.log('map loaded')
}

// Append the 'script' element to 'head'
document.head.appendChild(script)
