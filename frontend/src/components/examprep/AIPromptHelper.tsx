import React, { useState } from 'react';
import { useLocale } from '@/hooks/useLocale';
import { Button } from '@/components/ui/button';
import { useToast } from '@/context/ToastContext';
import { Bot, Copy, Check, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';


export const AIPromptHelper: React.FC = () => {
  const { locale } = useLocale();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const englishPrompt = `Role: You are a professional educator creating a 20-question multiple-choice exam based strictly on the provided context.

Instructions:
- Quantity: Generate exactly 20 questions.
- Clarity: Formulate the question in a clear, concise, and easily understandable manner.
- Options Quantity: Each question can have between 2 and 6 options depending on the question type.
- Question Types & Variety: Include a diverse mix of the following question formats:
  1. Standard Multiple-Choice: Standard questions with 3 to 6 options.
  2. True or False: True/False questions with exactly 2 options ("True" and "False").
  3. "All of the above" / "None of the above": Include questions where one option is "All of the options" (or "All of the above") or "None of the options" (or "None of the above").
- Options Formatting: Do NOT prefix options with letters, numbers, parentheses, or dashes (e.g., avoid "A)", "(B)", "1.", or "-"). Provide just the pure option text. Use commas inside the text if punctuation is needed.
- Plausibility & Length: Ensure all options are of similar word length and complexity so they do not inadvertently reveal the correct answer.
- Detailed Explanations: Provide a comprehensive explanation that defines the relevant concepts and details why the correct answer is right.
- Independence: Do not reference the context document directly (e.g., 'According to the text'). Each question and its explanation must be completely independent.
- Chapter Consistency: Verify the chapter or section references. Ensure consistency across the questions, keeping in mind that most content in a given context usually belongs to the same chapter.

Output Format:
Return the output strictly in the following JSON format:
[
  {
    "prompt": "What is the capital of France?",
    "chapter": "Geography",
    "explanation": "Paris has been the capital since...",
    "options": [
      { "text": "London", "correct": false },
      { "text": "Paris", "correct": true },
      { "text": "Berlin", "correct": false },
      { "text": "Madrid", "correct": false }
    ]
  },
  {
    "prompt": "The Earth is the third planet from the Sun.",
    "chapter": "Astronomy",
    "explanation": "Astronomy measurements place Earth as the third planet, after Mercury and Venus.",
    "options": [
      { "text": "True", "correct": true },
      { "text": "False", "correct": false }
    ]
  },
  {
    "prompt": "Which of the following are primary colors?",
    "chapter": "Art Theory",
    "explanation": "Red, yellow, and blue are the three traditional primary colors.",
    "options": [
      { "text": "Red", "correct": false },
      { "text": "Yellow", "correct": false },
      { "text": "Blue", "correct": false },
      { "text": "All of the options", "correct": true },
      { "text": "None of the options", "correct": false }
    ]
  }
]`;

  const ptPrompt = `Função: Atuas como um professor profissional que está a preparar um exame de escolha múltipla com 20 perguntas baseando-te estritamente no contexto fornecido.

Instruções:
- Quantidade: Gera exatamente 20 perguntas.
- Clareza: Formula a pergunta de forma clara, concisa e de fácil compreensão.
- Quantidade de Opções: Cada pergunta pode ter entre 2 e 6 opções, dependendo do tipo de pergunta.
- Tipos de Perguntas e Variedade: Inclui uma mistura diversa dos seguintes formatos de perguntas:
  1. Escolha Múltipla Padrão: Perguntas normais com 3 a 6 opções.
  2. Verdadeiro ou Falso: Perguntas com exatamente 2 opções ("Verdadeiro" e "Falso").
  3. "Todas as anteriores" / "Nenhuma das anteriores": Inclui perguntas onde uma das opções é "Todas as opções" (ou "Todas as anteriores") ou "Nenhuma das opções" (ou "Nenhuma das anteriores").
- Formatação das Opções: NÃO coloques prefixos nas opções com letras, números, parênteses ou travessões (ex: evita "A)", "(B)", "1.", ou "-"). Fornece apenas o texto puro da opção. Utiliza vírgulas dentro do texto se precisares de pontuação.
- Verosimilhança e Extensão: Garante que todas as opções de resposta têm uma extensão e complexidade semelhantes, evitando padrões que possam denunciar a resposta correta.
- Explicações Detalhadas: Fornece uma explicação detalhada que defina os conceitos e justifique a resposta correta.
- Independência: Não faças referência direta ao documento de contexto. Cada pergunta e explicação devem ser completamente independentes.
- Consistência dos Capítulos: Verifica as referências aos capítulos. Garante a consistência entre as perguntas.

Formato de Saída:
Devolve o resultado estritamente no seguinte formato JSON:
[
  {
    "prompt": "Qual é a capital de França?",
    "chapter": "Geografia",
    "explanation": "Paris é a capital desde...",
    "options": [
      { "text": "Londres", "correct": false },
      { "text": "Paris", "correct": true },
      { "text": "Berlim", "correct": false },
      { "text": "Madrid", "correct": false }
    ]
  },
  {
    "prompt": "A Terra é o terceiro planeta a partir do Sol.",
    "chapter": "Astronomia",
    "explanation": "As medições astronómicas colocam a Terra como o terceiro planeta, após Mercúrio e Vénus.",
    "options": [
      { "text": "Verdadeiro", "correct": true },
      { "text": "Falso", "correct": false }
    ]
  },
  {
    "prompt": "Quais das seguintes são cores primárias?",
    "chapter": "Teoria da Arte",
    "explanation": "Vermelho, amarelo e azul são as três cores primárias tradicionais.",
    "options": [
      { "text": "Vermelho", "correct": false },
      { "text": "Amarelo", "correct": false },
      { "text": "Azul", "correct": false },
      { "text": "Todas as opções", "correct": true },
      { "text": "Nenhuma das opções", "correct": false }
    ]
  }
]`;

  const promptText = locale === 'pt' ? ptPrompt : englishPrompt;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(promptText);
      setCopied(true);
      toast({ type: 'success', message: t('importPanel.promptCopied', 'AI prompt copied to clipboard!') });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ type: 'error', message: t('importPanel.copyFailed', 'Failed to copy text') });
    }
  };

  return (
    <div className="bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 border border-primary/20 rounded-2xl p-5 shadow-sm mb-6 relative overflow-hidden group">
      {/* Decorative background elements */}
      <div className="absolute -top-10 -right-10 opacity-10 pointer-events-none transition-transform group-hover:scale-110 duration-700">
        <Bot size={150} />
      </div>
      
      <div className="relative z-10 flex flex-col sm:flex-row gap-5 items-start">
        <div className="bg-primary/10 text-primary p-3 rounded-xl shrink-0">
          <Sparkles size={24} className="animate-pulse" />
        </div>
        
        <div className="flex-1 space-y-2">
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            {t('importPanel.aiPromptTitle', 'Generate Questions with AI')}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t(
              'importPanel.aiPromptDescPlain',
              'Copy this prompt and paste it into an assistant such as ChatGPT or Claude along with your notes. Then bring the result back here to import it.'
            )}
          </p>
          
          <div className="pt-3">
            <Button 
              onClick={handleCopy} 
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-md hover:shadow-lg transition-all rounded-xl h-10 px-5 flex items-center gap-2"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? t('importPanel.copied', 'Copied!') : t('importPanel.copyPromptPlain', 'Copy AI prompt')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
