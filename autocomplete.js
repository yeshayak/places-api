export const initializeAutocomplete = async (inputSelector) => {
  const autocompleteInput = document.querySelector(inputSelector)
  if (!autocompleteInput) {
    console.error(`Input element not found for selector: ${inputSelector}`)
    return null
  }
  const autocomplete = new window.google.maps.places.Autocomplete(autocompleteInput, {
    componentRestrictions: { country: 'us' },
    fields: ['address_components', 'name'],
  })
  autocompleteInput.onfocus = () => {
    autocompleteInput.autocomplete = 'new-password'
  }
  // console.log(`Autocomplete initialized for input: ${inputSelector}`)
  return autocomplete
}

export const handlePlaceSelect = async (autocomplete, addressFields, includeName) => {
  // console.log('handlePlaceSelect')
  const addressObject = autocomplete.getPlace()
  if (!addressObject) {
    throw new Error('No place selected')
  }
  const place = { address1: '', address2: '' }
  if (includeName) {
    place.name = addressObject.name
  }
  addressObject.address_components.forEach((component) => {
    if (component.types.includes('street_number')) place.address1 = `${component.short_name} `
    if (component.types.includes('route')) place.address1 += `${component.short_name}`
    if (component.types.includes('subpremise')) place.address2 = component.short_name
    if (component.types.includes('locality')) place.city = component.short_name
    if (component.types.includes('sublocality_level_1')) place.city = component.short_name
    if (component.types.includes('administrative_area_level_1')) place.state = component.short_name
    if (component.types.includes('postal_code')) place.postal_code = component.short_name
  })
  console.log(place, addressObject)

  // Loop through all the components and update the field that contains that name
  for (let component in place) {
    console.log(component, place[component])
    const id = document.querySelector(addressFields).querySelector(`[id$=${component}]`).id
    const fieldName = id.split('.')[1]
    window.angular
      .element(document.getElementById(id))
      .scope()
      .$apply(({ record }) => {
        record[fieldName] = place[component]
      })
    await window.angular
      .element(document.getElementById(id))
      .scope()
      .onChange()
      .then((e) => {
        // console.log(e);
      })
      .catch((error) => {
        console.log(error)
      })
  }
}
