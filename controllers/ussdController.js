const supabase = require('../config/supabaseClient')

// Validation helpers
const isValidNumber = (value) => {
  return !isNaN(value) && Number(value) > 0
}

const isValidName = (value) => {
  return value && value.trim().length >= 2 && /^[a-zA-Z\s]+$/.test(value.trim())
}

const isValidLocation = (value) => {
  return value && value.trim().length >= 2
}

const isValidMenuChoice = (value, options) => {
  return options.includes(value.trim())
}

const handleUssd = async (req, res) => {
  const { sessionId, serviceCode, phoneNumber, text } = req.body
  const textArray = text.split('*')
  const userInput = textArray[textArray.length - 1].trim()
  let response = ''

  // Main menu
  if (text === '') {
    response = `CON Welcome to Agri-D Ledger\n1. List Produce\n2. Check My Listings\n3. View Prices\n4. Register`

  // Option 1 - List Produce
  } else if (text === '1') {
    response = `CON Select crop type:\n1. Maize\n2. Potatoes`

  // Option 1 - Crop selected
  } else if (textArray.length === 2 && textArray[0] === '1') {
    if (!isValidMenuChoice(userInput, ['1', '2'])) {
      response = `CON Invalid choice. Select crop type:\n1. Maize\n2. Potatoes`
    } else {
      const crops = { '1': 'Maize', '2': 'Potatoes' }
      const crop = crops[userInput]
      response = `CON ${crop} selected.\nEnter quantity (bags):`
    }

  // Option 1 - Quantity entered
  } else if (textArray.length === 3 && textArray[0] === '1') {
    if (!isValidMenuChoice(textArray[1], ['1', '2'])) {
      response = `END Invalid crop selection. Please start again.`
    } else if (!isValidNumber(userInput)) {
      response = `CON Invalid quantity. Must be a number greater than 0.\nEnter quantity (bags):`
    } else if (Number(userInput) > 10000) {
      response = `CON Quantity too large. Maximum is 10,000 bags.\nEnter quantity (bags):`
    } else {
      response = `CON Enter your asking price per bag (KES):`
    }

  // Option 1 - Price entered - show summary
  } else if (textArray.length === 4 && textArray[0] === '1') {
    const crops = { '1': 'Maize', '2': 'Potatoes' }
    const crop = crops[textArray[1]]
    const quantity = textArray[2]
    const price = userInput

    if (!isValidNumber(price)) {
      response = `CON Invalid price. Must be a number greater than 0.\nEnter price per bag (KES):`
    } else if (Number(price) < 100) {
      response = `CON Price too low. Minimum is KES 100.\nEnter price per bag (KES):`
    } else if (Number(price) > 100000) {
      response = `CON Price too high. Maximum is KES 100,000.\nEnter price per bag (KES):`
    } else {
      const total = (Number(quantity) * Number(price)).toLocaleString()
      response = `CON Summary:\nCrop: ${crop}\nQty: ${quantity} bags\nPrice: KES ${price}/bag\nTotal: KES ${total}\n\n1. Confirm\n2. Cancel`
    }

  // Option 1 - Confirm listing - save to Supabase
  } else if (textArray.length === 5 && textArray[0] === '1') {
    if (!isValidMenuChoice(userInput, ['1', '2'])) {
      response = `CON Invalid choice.\n1. Confirm\n2. Cancel`
    } else if (userInput === '1') {
      const crops = { '1': 'Maize', '2': 'Potatoes' }
      const crop = crops[textArray[1]]
      const quantity = textArray[2]
      const price = textArray[3]
      const listingId = `LST-${Date.now()}`

      const { error } = await supabase
        .from('produce_listings')
        .insert({
          listing_id: listingId,
          phone_number: phoneNumber,
          crop_type: crop,
          quantity: parseFloat(quantity),
          asked_price: parseFloat(price),
          status: 'pending'
        })

      if (error) {
        console.log('Listing error:', error.message)
        response = `END Something went wrong. Please try again.`
      } else {
        response = `END Listing submitted!\nRef: ${listingId}\n\nYou will receive an SMS when a buyer is found.`
      }
    } else {
      response = `END Listing cancelled.`
    }

  // Option 2 - Check My Listings
  } else if (text === '2') {
    const { data, error } = await supabase
      .from('produce_listings')
      .select('crop_type, quantity, status')
      .eq('phone_number', phoneNumber)
      .limit(3)

    if (error || !data || data.length === 0) {
      response = `END You have no listings yet.`
    } else {
      let list = data.map(l => `${l.crop_type} - ${l.quantity} bags - ${l.status}`).join('\n')
      response = `END Your listings:\n${list}`
    }

  // Option 3 - View Prices
  } else if (text === '3') {
    response = `END Price checker coming soon.`

  // Option 4 - Register - enter name
  } else if (text === '4') {
    response = `CON Enter your full name:`

  // Option 4 - Enter location
  } else if (textArray.length === 2 && textArray[0] === '4') {
    if (!isValidName(userInput)) {
      response = `CON Invalid name. Use letters only, min 2 characters.\nEnter your full name:`
    } else {
      response = `CON Enter your location:`
    }

  // Option 4 - Save registration to Supabase
  } else if (textArray.length === 3 && textArray[0] === '4') {
    const name = textArray[1].trim()
    const location = userInput

    if (!isValidLocation(location)) {
      response = `CON Invalid location. Min 2 characters.\nEnter your location:`
    } else {
      const { error } = await supabase
        .from('farmers')
        .upsert({
          phone_number: phoneNumber,
          name: name,
          location: location
        })

      if (error) {
        console.log('Registration error:', error.message)
        response = `END Registration failed. Please try again.`
      } else {
        response = `END Registration successful!\nName: ${name}\nLocation: ${location}\n\nWelcome to Agri-D Ledger!`
      }
    }

  } else {
    response = `END Invalid option. Please try again.`
  }

  res.set('Content-Type', 'text/plain')
  res.send(response)
}

module.exports = { handleUssd }