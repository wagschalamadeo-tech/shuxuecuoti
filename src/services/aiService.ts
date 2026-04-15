import { GoogleGenAI, Type } from "@google/genai";
import { OCRResult, Variation } from "../types";

const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  return new GoogleGenAI({ apiKey: apiKey || '' });
};

export const aiService = {
  async recognizeQuestion(base64Image: string, mimeType: string): Promise<OCRResult> {
    try {
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              {
                text: `你是一个专业的教育OCR助手。请识别图片中的题目内容。
                要求：
                1. 提取题目文本。
                2. 如果有选项，提取选项。
                3. 如果有用户原答案，提取出来。
                4. 如果有标准答案，提取出来。
                5. 判断该题目的核心知识点（例如：“一元二次方程根的判别式”、“现在完成时态”等）。
                请以JSON格式返回。`,
              },
              {
                inlineData: {
                  data: base64Image.split(",")[1],
                  mimeType: mimeType,
                },
              },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING, description: "题目文本" },
              options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "选项列表" },
              userAnswer: { type: Type.STRING, description: "用户填写的答案" },
              correctAnswer: { type: Type.STRING, description: "标准答案" },
              knowledgePoint: { type: Type.STRING, description: "核心知识点" },
            },
            required: ["text", "knowledgePoint"],
          },
        },
      });

      if (!response.text) {
        throw new Error("AI 未返回识别结果，请尝试重新上传更清晰的图片。");
      }

      console.log("OCR successful");
      return JSON.parse(response.text) as OCRResult;
    } catch (error: any) {
      console.error("OCR Error:", error);
      throw new Error(error.message || "识别失败，请稍后重试。");
    }
  },

  async generateVariations(originalQuestion: string, knowledgePoint: string): Promise<Variation[]> {
    try {
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              {
                text: `基于以下原题和知识点，生成3道“举一反三”的变式题。
                原题：${originalQuestion}
                知识点：${knowledgePoint}
                
                要求：
                1. 3道题的难度分别为：简单、中等、困难。
                2. 变式题应覆盖同一知识点的不同角度。
                3. 每道题必须包含：
                   - question: 题目内容。
                   - explanation: 小助手讲解（即思路引导）。要求：
                     - 开头必须有一句简洁精炼的“解题金句”。
                     - 采用布鲁姆引导式，使用“大礼包”、“分糖果”、“排排队”等具象思维方式引导小朋友思考。
                     - 语言风格：专业、清晰、不口语化，严格符合小学二年级认知水平。
                     - 结尾必须包含“【易错点】”和“【疑难点】”两个部分，且这两个部分要分段显示。
                     - **格式极其重要：每一句话结束（如句号、问号、感叹号后）必须立即使用 \n 换行，绝对不允许两句话连在同一行。**
                   - steps: 具体的解题步骤。
                     - 在每一步骤之前，必须先解释“为什么要这么做”（即解题逻辑和原因），然后再给出具体的计算或操作。
                     - **格式要求：步骤中的每一句话也要独立成行（使用 \n 换行）。**
                   - answer: 最终正确答案。
                   - difficulty: 难度等级。
                请以JSON格式返回。`,
              },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING, description: "变式题题目" },
                answer: { type: Type.STRING, description: "最终答案" },
                steps: { type: Type.ARRAY, items: { type: Type.STRING }, description: "具体的解题步骤" },
                explanation: { type: Type.STRING, description: "用二年级水平讲解的精炼解析" },
                difficulty: { type: Type.STRING, enum: ["简单", "中等", "困难"], description: "难度等级" },
              },
              required: ["question", "answer", "steps", "explanation", "difficulty"],
            },
          },
        },
      });

      if (!response.text) {
        throw new Error("AI 未能生成变式题，请重试。");
      }

      console.log("Variation generation successful");
      return JSON.parse(response.text) as Variation[];
    } catch (error: any) {
      console.error("Generation Error:", error);
      throw new Error(error.message || "生成失败，请稍后重试。");
    }
  },
};
