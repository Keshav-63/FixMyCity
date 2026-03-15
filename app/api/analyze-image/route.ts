import { HfInference } from '@huggingface/inference'

const hf = new HfInference(process.env.HUGGINGFACE_API_KEY)

interface AnalysisResult {
  isAppropriate: boolean
  suggestedCategory: 'pothole' | 'water' | 'trash' | 'electrical' | 'road' | 'other' | null
  confidence: number
  reason: string | null
  suggestedTitle?: string
  suggestedDescription?: string
}

// Generate title and description based on category and image analysis
function generateTitleAndDescription(
  category: 'pothole' | 'water' | 'trash' | 'electrical' | 'road' | 'other',
  imageDescription: string,
  confidence: number
): { title: string; description: string } {
  const templates = {
    pothole: {
      titles: [
        'Potholes on Road',
        'Road Surface Damage',
        'Multiple Potholes Detected',
        'Damaged Road Pavement',
        'Road Repair Needed'
      ],
      descriptions: [
        'Multiple potholes detected on the road surface causing potential hazard to vehicles. The road pavement shows significant damage and requires immediate repair.',
        'Damaged road surface with visible potholes. This poses a safety risk to motorists and needs urgent attention from the maintenance department.',
        'Several potholes have formed on this road section. The deteriorating pavement condition could lead to vehicle damage and requires prompt repair work.',
        'Road surface shows significant wear with multiple potholes. This infrastructure issue needs immediate attention to prevent further deterioration and ensure road safety.'
      ]
    },
    water: {
      titles: [
        'Water Leak Detected',
        'Flooding on Street',
        'Drainage Issue',
        'Water Accumulation Problem',
        'Broken Water Pipe'
      ],
      descriptions: [
        'Water leak or flooding observed on the street. This could be from a broken pipe or drainage issue that requires immediate investigation and repair.',
        'Significant water accumulation detected. This may indicate a drainage problem or water main leak that needs urgent attention from the utilities department.',
        'Water flooding issue on the street causing inconvenience and potential damage. The drainage system appears to be malfunctioning and requires repair.',
        'Water leakage or flooding detected at this location. This infrastructure problem could worsen if not addressed promptly by the water department.'
      ]
    },
    trash: {
      titles: [
        'Trash Accumulation',
        'Illegal Dumping Detected',
        'Overflowing Garbage',
        'Waste Disposal Issue',
        'Littering Problem'
      ],
      descriptions: [
        'Excessive trash and garbage accumulation observed at this location. Regular cleanup and proper waste management is needed to maintain community hygiene.',
        'Illegal dumping or trash accumulation creating unsanitary conditions. This requires immediate cleanup and proper waste disposal enforcement.',
        'Garbage overflow and littering issue affecting the cleanliness of the area. The sanitation department should address this waste management problem.',
        'Significant waste accumulation detected. This poses health and environmental concerns and requires prompt cleanup by the municipal waste management team.'
      ]
    },
    electrical: {
      titles: [
        'Streetlight Not Working',
        'Electrical Hazard Detected',
        'Broken Street Light',
        'Power Line Issue',
        'Lighting Problem'
      ],
      descriptions: [
        'Streetlight malfunction or electrical issue detected. This affects public safety and visibility, requiring urgent attention from the electrical maintenance team.',
        'Electrical infrastructure problem observed, possibly involving streetlights or power lines. This requires immediate inspection and repair for public safety.',
        'Non-functional streetlight creating a dark spot on the road. This poses a safety concern for pedestrians and drivers, especially during night hours.',
        'Electrical hazard or lighting issue detected at this location. The municipal electrical department should inspect and repair this infrastructure problem promptly.'
      ]
    },
    road: {
      titles: [
        'Road Damage Detected',
        'Damaged Road Sign',
        'Broken Barrier',
        'Road Infrastructure Issue',
        'Street Maintenance Required'
      ],
      descriptions: [
        'Road infrastructure damage observed including possible issues with signs, barriers, or road surface. This requires inspection and repair by the road maintenance department.',
        'Damaged road infrastructure affecting traffic safety and navigation. The issue includes problems with road signs, barriers, or general road condition that need repair.',
        'Road maintenance issue detected involving damaged infrastructure elements. This requires attention from the municipal road department to ensure safe travel conditions.',
        'Infrastructure damage to road elements observed. This could affect traffic flow and safety, requiring prompt inspection and repair by maintenance crews.'
      ]
    },
    other: {
      titles: [
        'Civic Infrastructure Issue',
        'Public Property Damage',
        'Municipal Maintenance Required',
        'Community Infrastructure Problem',
        'Public Facility Issue'
      ],
      descriptions: [
        'Infrastructure or public property issue detected that requires municipal attention. Please inspect this location to determine the specific problem and necessary repairs.',
        'Civic infrastructure problem observed that needs assessment by the appropriate municipal department. This may require further investigation to determine the exact nature.',
        'Public property or infrastructure issue requiring municipal inspection and potential repair. The specific category is unclear but the problem appears to need official attention.',
        'Community infrastructure concern detected. This requires evaluation by municipal services to assess the situation and take appropriate maintenance action.'
      ]
    }
  }

  const categoryTemplates = templates[category]

  // Add variation based on image description keywords
  let titleIndex = 0
  let descIndex = 0

  // Select template based on keywords in description
  if (imageDescription.includes('multiple') || imageDescription.includes('several')) {
    titleIndex = 2
  } else if (imageDescription.includes('damage') || imageDescription.includes('broken')) {
    titleIndex = 1
    descIndex = 1
  } else if (imageDescription.includes('cover') || imageDescription.includes('manhole')) {
    titleIndex = 3
    descIndex = 2
  }

  const title = categoryTemplates.titles[titleIndex]
  const description = categoryTemplates.descriptions[descIndex]

  return { title, description }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const imageFile = formData.get('image') as File

    if (!imageFile) {
      return Response.json({ error: 'No image provided' }, { status: 400 })
    }

    if (!process.env.HUGGINGFACE_API_KEY) {
      console.error('HUGGINGFACE_API_KEY is not set')
      return Response.json({ error: 'API key not configured' }, { status: 500 })
    }

    // Convert file to blob for Hugging Face API
    const imageBlob = await imageFile.arrayBuffer()

    // Use ViT-GPT2 image captioning (available in free tier)
    // This model generates detailed descriptions of images
    let imageDescription = ''

    try {
      console.log('🔍 Starting image analysis...')

      const captionResponse = await hf.imageToText({
        model: 'nlpconnect/vit-gpt2-image-captioning',
        data: new Blob([imageBlob], { type: imageFile.type })
      })

      imageDescription = captionResponse.generated_text.toLowerCase()
      console.log('✅ Image description:', imageDescription)
    } catch (err) {
      console.error('❌ Image captioning error:', err)

      // Try fallback to image classification instead
      try {
        console.log('🔄 Trying image classification fallback...')

        const classificationResponse = await hf.imageClassification({
          model: 'google/vit-base-patch16-224',
          data: new Blob([imageBlob], { type: imageFile.type })
        })

        console.log('✅ Classification results:', classificationResponse)

        // Use top classification result as description
        if (classificationResponse && classificationResponse.length > 0) {
          imageDescription = classificationResponse[0].label.toLowerCase()
          console.log('📊 Using classification label as description:', imageDescription)
        }
      } catch (classErr) {
        console.error('❌ Classification fallback also failed:', classErr)

        // Last resort: return other with explanation
        return Response.json({
          isAppropriate: true,
          suggestedCategory: 'other',
          confidence: 0.3,
          reason: null
        } as AnalysisResult)
      }
    }

    if (!imageDescription) {
      console.log('⚠️ No description generated, returning low confidence')
      return Response.json({
        isAppropriate: true,
        suggestedCategory: 'other',
        confidence: 0.3,
        reason: null
      } as AnalysisResult)
    }

    // Check for inappropriate content
    const inappropriateKeywords = [
      'violence', 'violent', 'blood', 'weapon', 'gun', 'knife',
      'naked', 'nude', 'explicit', 'sexual', 'pornographic',
      'offensive', 'disturbing', 'graphic'
    ]

    const isInappropriate = inappropriateKeywords.some(keyword =>
      imageDescription.includes(keyword)
    )

    if (isInappropriate) {
      console.log('❌ Inappropriate content detected')
      return Response.json({
        isAppropriate: false,
        suggestedCategory: null,
        confidence: 0.85,
        reason: 'Image contains inappropriate content'
      } as AnalysisResult)
    }

    // Check for obviously non-civic images
    // Note: We DON'T reject infrastructure items like "manhole", "pole", "street sign" etc.
    const definitelyNonCivicKeywords = [
      'website', 'web site', 'internet site', 'screen', 'monitor', 'computer', 'laptop',
      'person', 'people', 'man', 'woman', 'child', 'face', 'portrait', 'selfie',
      'food', 'meal', 'plate', 'dish', 'restaurant', 'kitchen', 'dining',
      'animal', 'dog', 'cat', 'pet', 'bird', 'horse', 'wildlife',
      'building interior', 'room', 'bedroom', 'living room', 'office', 'indoor',
      'document', 'paper', 'text', 'book', 'magazine', 'newspaper',
      'sky', 'cloud', 'sunset', 'sunrise', 'ocean', 'beach',
      'plant', 'flower', 'grass only', 'garden', 'tree only',
      'clothing', 'shirt', 'dress', 'shoes', 'fashion'
    ]

    // Only reject if it's DEFINITELY not civic infrastructure
    const hasOnlyNonCivicContent = definitelyNonCivicKeywords.some(keyword =>
      imageDescription.includes(keyword)
    )

    // Additional check: does it have ANY civic-related words?
    const civicRelatedWords = [
      'road', 'street', 'pavement', 'asphalt', 'sidewalk',
      'pothole', 'hole', 'crack', 'damage',
      'water', 'leak', 'flood', 'drain', 'sewer',
      'trash', 'garbage', 'waste', 'litter', 'dump',
      'light', 'pole', 'wire', 'electrical', 'power',
      'sign', 'barrier', 'guardrail', 'fence',
      'manhole', 'cover', 'grate', 'curb'
    ]

    const hasCivicWords = civicRelatedWords.some(word =>
      imageDescription.includes(word)
    )

    // Only reject if clearly non-civic AND has no civic words
    if (hasOnlyNonCivicContent && !hasCivicWords) {
      console.log('❌ Definitely non-civic content detected:', imageDescription)
      return Response.json({
        isAppropriate: false,
        suggestedCategory: null,
        confidence: 0.8,
        reason: 'This image does not appear to show a civic infrastructure issue. Please upload an image showing road damage, potholes, water leaks, trash, electrical problems, or other civic issues.'
      } as AnalysisResult)
    }

    // Advanced category matching with multiple keywords and scoring
    const categoryPatterns: Record<string, { keywords: string[], weight: number }[]> = {
      pothole: [
        { keywords: ['pothole', 'hole'], weight: 1.0 },
        { keywords: ['crack', 'cracked', 'damaged pavement', 'broken pavement'], weight: 0.9 },
        { keywords: ['manhole cover', 'manhole', 'cover'], weight: 0.85 }, // Often confused with potholes
        { keywords: ['road damage', 'asphalt damage', 'pavement'], weight: 0.8 },
        { keywords: ['sewer', 'grate', 'drain cover'], weight: 0.7 },
        { keywords: ['street', 'road', 'asphalt'], weight: 0.5 }
      ],
      water: [
        { keywords: ['water', 'leak', 'leaking'], weight: 1.0 },
        { keywords: ['flood', 'flooding', 'flooded'], weight: 0.95 },
        { keywords: ['drainage', 'drain', 'pipe', 'sewage'], weight: 0.85 },
        { keywords: ['puddle', 'wet'], weight: 0.6 }
      ],
      trash: [
        { keywords: ['trash', 'garbage', 'waste'], weight: 1.0 },
        { keywords: ['litter', 'littering', 'dump', 'dumped'], weight: 0.95 },
        { keywords: ['trash can', 'wastebin', 'dustbin', 'trash bin', 'garbage can'], weight: 0.9 },
        { keywords: ['rubbish', 'debris', 'junk'], weight: 0.85 },
        { keywords: ['dirty', 'mess'], weight: 0.5 }
      ],
      electrical: [
        { keywords: ['streetlight', 'street light', 'lamp post'], weight: 1.0 },
        { keywords: ['wire', 'wires', 'cable', 'electrical'], weight: 0.9 },
        { keywords: ['power line', 'utility pole', 'transformer'], weight: 0.85 },
        { keywords: ['pole'], weight: 0.7 }, // Generic pole could be utility/street light
        { keywords: ['light', 'lighting'], weight: 0.5 }
      ],
      road: [
        { keywords: ['road sign', 'traffic sign', 'sign post', 'street sign'], weight: 1.0 },
        { keywords: ['barrier', 'fence', 'guardrail'], weight: 0.9 },
        { keywords: ['curb', 'sidewalk damage'], weight: 0.8 },
        { keywords: ['road', 'street', 'pavement', 'sidewalk'], weight: 0.6 },
        { keywords: ['construction', 'repair'], weight: 0.5 }
      ]
    }

    // Calculate scores for each category
    console.log('🎯 Analyzing description against categories...')
    let bestCategory: AnalysisResult['suggestedCategory'] = null
    let bestScore = 0
    const categoryScores: Record<string, number> = {}

    for (const [category, patterns] of Object.entries(categoryPatterns)) {
      let categoryScore = 0

      for (const pattern of patterns) {
        const matchFound = pattern.keywords.some(keyword =>
          imageDescription.includes(keyword)
        )
        if (matchFound) {
          categoryScore = Math.max(categoryScore, pattern.weight)
          console.log(`  ✓ ${category}: matched "${pattern.keywords.join('/')}" (weight: ${pattern.weight})`)
        }
      }

      categoryScores[category] = categoryScore

      if (categoryScore > bestScore) {
        bestScore = categoryScore
        bestCategory = category as AnalysisResult['suggestedCategory']
      }
    }

    console.log('📊 Category scores:', categoryScores)
    console.log(`🏆 Best match: ${bestCategory} (score: ${bestScore})`)

    // Determine confidence based on score
    let confidence = 0
    if (bestScore >= 0.85) {
      confidence = 0.85
    } else if (bestScore >= 0.7) {
      confidence = 0.75
    } else if (bestScore >= 0.5) {
      confidence = 0.65
    } else if (bestScore >= 0.3) {
      confidence = 0.5
    } else {
      confidence = 0.4
    }

    // More lenient threshold - accept anything that scored > 0 and has civic words
    // Only reject if score is 0 or very low AND has no civic-related words
    if (!bestCategory || (bestScore < 0.25 && !hasCivicWords)) {
      console.log('❌ No civic issue category matched (score < 0.25 and no civic words)')
      console.log('📝 Image description was:', imageDescription)
      return Response.json({
        isAppropriate: false,
        suggestedCategory: null,
        confidence: 0,
        reason: 'Unable to identify a civic infrastructure issue in this image. Please upload a clear photo showing road damage, potholes, water leaks, trash, electrical problems, or other municipal infrastructure issues.'
      } as AnalysisResult)
    }

    // If we have SOME match but it's weak, mark as "other" but still accept
    if (bestScore < 0.5 && bestScore > 0) {
      console.log('⚠️ Weak match detected, accepting as "other"')
      bestCategory = 'other'
      confidence = 0.45
    }

    console.log(`✅ Final result: ${bestCategory} with ${Math.round(confidence * 100)}% confidence`)

    // Generate title and description based on category and image analysis
    const { title, description } = generateTitleAndDescription(bestCategory!, imageDescription, confidence)

    console.log('📝 Generated title:', title)
    console.log('📝 Generated description:', description)

    return Response.json({
      isAppropriate: true,
      suggestedCategory: bestCategory,
      confidence,
      reason: null,
      suggestedTitle: title,
      suggestedDescription: description
    } as AnalysisResult)

  } catch (error) {
    console.error('Error analyzing image:', error)
    return Response.json(
      {
        isAppropriate: true,
        suggestedCategory: null,
        confidence: 0,
        reason: null
      } as AnalysisResult,
      { status: 200 }
    )
  }
}
