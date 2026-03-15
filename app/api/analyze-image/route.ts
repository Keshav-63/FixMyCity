import { generateText, Output } from 'ai'
import { z } from 'zod'

const analysisSchema = z.object({
  isAppropriate: z.boolean().describe('Whether the image is appropriate (no violence, explicit content, etc.)'),
  suggestedCategory: z.enum(['pothole', 'water', 'trash', 'electrical', 'road', 'other']).nullable().describe('The suggested category for this civic issue'),
  confidence: z.number().min(0).max(1).describe('Confidence level of the category suggestion (0-1)'),
  reason: z.string().nullable().describe('Reason if image is inappropriate, null otherwise'),
})

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const imageFile = formData.get('image') as File
    
    if (!imageFile) {
      return Response.json({ error: 'No image provided' }, { status: 400 })
    }

    // Convert file to base64
    const bytes = await imageFile.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')
    const mimeType = imageFile.type || 'image/jpeg'
    const dataUrl = `data:${mimeType};base64,${base64}`

    const { output } = await generateText({
      model: 'openai/gpt-4o-mini',
      output: Output.object({
        schema: analysisSchema,
      }),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analyze this image for a civic issue reporting platform. 
              
              1. First, check if the image is appropriate (no violence, explicit content, harassment, etc.)
              2. If appropriate, identify what type of civic issue is shown (pothole, water issue, trash/garbage, electrical problem, road damage, or other)
              3. Provide a confidence score for your categorization

              Categories:
              - pothole: Holes or damage in road pavement
              - water: Water leaks, flooding, drainage issues
              - trash: Garbage, litter, illegal dumping
              - electrical: Broken streetlights, exposed wires, electrical hazards
              - road: General road damage, broken signs, damaged barriers
              - other: Any other civic issue not in above categories
              
              If the image doesn't show a civic issue at all, use "other" with low confidence.`,
            },
            {
              type: 'image',
              image: dataUrl,
            },
          ],
        },
      ],
    })

    return Response.json(output)
  } catch (error) {
    console.error('Error analyzing image:', error)
    return Response.json(
      { 
        isAppropriate: true, 
        suggestedCategory: null, 
        confidence: 0,
        reason: null 
      },
      { status: 200 }
    )
  }
}
