export interface Fact {
  id: number;
  content: string;
  category: string;
  confidence: number;
  created_at: string;
  updated_at: string;
  source_conversation_id: string;
  project_id?: string;
  vec_id: number;
  embedding?: Float32Array;
}

export interface Conversation {
  id: string;
  project_id?: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface ConversationMessage {
  id: number;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  processed_for_facts: boolean;
}
