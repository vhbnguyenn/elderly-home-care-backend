const Groq = require('groq-sdk');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

class AIService {
  async chat(messages, options = {}) {
    try {
      const completion = await groq.chat.completions.create({
        messages,
        model: options.model || 'llama-3.3-70b-versatile',
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 1024,
        top_p: options.topP || 1,
        stream: false,
      });

      return completion.choices[0]?.message?.content || '';
    } catch (error) {
      console.error('Groq AI Error:', error);
      throw new Error('Failed to get AI response');
    }
  }

  async recommendCaregiver(elderlyProfile, availableCaregivers) {
    const prompt = `
You are an AI assistant for an elderly care platform. Analyze the elderly profile and recommend the most suitable caregiver from the list.

Elderly Profile:
- Age: ${elderlyProfile.age}
- Health Conditions: ${elderlyProfile.healthConditions?.join(', ') || 'None'}
- Special Needs: ${elderlyProfile.specialNeeds || 'None'}
- Preferred Language: ${elderlyProfile.language || 'Any'}

Available Caregivers:
${availableCaregivers.map((c, i) => `
${i + 1}. ${c.fullName}
   - Experience: ${c.yearsOfExperience} years
   - Specializations: ${c.specializations?.join(', ') || 'General care'}
   - Languages: ${c.languages?.join(', ') || 'English'}
   - Rating: ${c.rating || 'N/A'}
`).join('\n')}

Recommend the top 3 most suitable caregivers with detailed reasoning for each recommendation.
Format your response as JSON:
{
  "recommendations": [
    {
      "caregiverId": "id",
      "name": "name",
      "matchScore": 95,
      "reasoning": "detailed explanation"
    }
  ]
}
`;

    const messages = [
      {
        role: 'user',
        content: prompt,
      },
    ];

    const response = await this.chat(messages, { temperature: 0.3 });
    
    try {
      return JSON.parse(response);
    } catch (error) {
      return { recommendations: [], error: 'Failed to parse AI response' };
    }
  }

  async chatbot(userMessage, conversationHistory = []) {
    const systemPrompt = {
      role: 'system',
      content: `You are a helpful AI assistant for an elderly home care platform. 
You help users with:
- Finding suitable caregivers
- Understanding care services
- Booking appointments
- Answering questions about elderly care
- Providing health and wellness tips for elderly

Be empathetic, professional, and concise in your responses.`,
    };

    const messages = [
      systemPrompt,
      ...conversationHistory,
      {
        role: 'user',
        content: userMessage,
      },
    ];

    return await this.chat(messages);
  }

  async generateCareplan(elderlyProfile) {
    const prompt = `
Create a personalized daily care plan for an elderly person with the following profile:

Name: ${elderlyProfile.fullName}
Age: ${elderlyProfile.age}
Health Conditions: ${elderlyProfile.healthConditions?.join(', ') || 'None'}
Mobility Level: ${elderlyProfile.mobilityLevel || 'Not specified'}
Medications: ${elderlyProfile.medications?.join(', ') || 'None'}
Dietary Restrictions: ${elderlyProfile.dietaryRestrictions?.join(', ') || 'None'}

Generate a comprehensive daily care plan including:
1. Morning routine
2. Medication schedule
3. Meal plan
4. Exercise/activities
5. Evening routine
6. Special considerations

Format as structured JSON.
`;

    const messages = [
      {
        role: 'user',
        content: prompt,
      },
    ];

    const response = await this.chat(messages, { temperature: 0.5, maxTokens: 2048 });
    
    try {
      return JSON.parse(response);
    } catch (error) {
      return { careplan: response };
    }
  }

  async analyzeHealthConcerns(symptoms) {
    const prompt = `
As a healthcare AI assistant, analyze these symptoms reported by or for an elderly person:

Symptoms: ${symptoms}

Provide:
1. Possible causes (not diagnosis)
2. Urgency level (Low/Medium/High/Emergency)
3. Recommended actions
4. When to seek medical attention

IMPORTANT: Always emphasize that this is not medical advice and they should consult healthcare professionals.

Format as JSON:
{
  "urgency": "level",
  "possibleCauses": [],
  "recommendations": [],
  "seekMedicalAttention": true/false,
  "disclaimer": "text"
}
`;

    const messages = [
      {
        role: 'user',
        content: prompt,
      },
    ];

    const response = await this.chat(messages, { temperature: 0.3 });
    
    try {
      return JSON.parse(response);
    } catch (error) {
      return { 
        error: 'Failed to analyze',
        disclaimer: 'This is not medical advice. Please consult a healthcare professional.'
      };
    }
  }
}

module.exports = new AIService();
