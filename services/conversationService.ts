// src/services/conversationService.ts - Complete implementation
import { v4 as uuidv4 } from 'uuid';
import { Conversation, Message } from './types';
import vscode from '../utils/vscode';

/**
 * Service class for managing conversations
 */
export class ConversationService {
  /**
   * Generate a title from the first message content
   */
  static generateTitle(message: string): string {
    const words = message.split(' ');
    const title = words.slice(0, 5).join(' ');
    return title.length < message.length ? `${title}...` : title;
  }
  
  /**
   * Create a new conversation
   */
  static createConversation(
    initialMessage: string | null,
    modelId: string,
    systemPrompt?: string,
    temperature?: number
  ): Conversation {
    const now = new Date();
    const messages: Message[] = [];
    
    if (initialMessage) {
      messages.push({
        id: uuidv4(),
        role: 'user',
        content: initialMessage,
        timestamp: now
      });
    }
    
    return {
      id: uuidv4(),
      title: initialMessage 
        ? this.generateTitle(initialMessage) 
        : "New conversation",
      messages,
      modelId,
      createdAt: now,
      updatedAt: now,
      systemPrompt,
      temperature: temperature ?? 0.7
    };
  }
  
  /**
   * Add a message to a conversation
   */
  static addMessageToConversation(
    conversation: Conversation,
    content: string,
    role: 'user' | 'assistant' | 'system'
  ): Conversation {
    const message: Message = {
      id: uuidv4(),
      role,
      content,
      timestamp: new Date()
    };
    
    // Create a new conversation object to ensure immutability
    return {
      ...conversation,
      messages: [...conversation.messages, message],
      updatedAt: new Date(),
      // Update title if this is the first message
      title: conversation.messages.length === 0 && role === 'user'
        ? this.generateTitle(content)
        : conversation.title
    };
  }
  
  /**
   * Load conversations from storage
   */
  static loadConversations(): void {
    vscode.postMessage({
      command: 'loadConversations'
    });
  }
  
  /**
   * Save conversation to storage
   */
  static saveConversation(conversation: Conversation): void {
    vscode.postMessage({
      command: 'saveConversation',
      conversation
    });
  }
  
  /**
   * Delete conversation from storage
   */
  static deleteConversation(conversationId: string): void {
    vscode.postMessage({
      command: 'deleteConversation',
      conversationId
    });
  }
  
  /**
   * Export conversation to JSON file
   */
  static exportConversationToJSON(conversation: Conversation): void {
    const exportData = {
      title: conversation.title,
      model: conversation.modelId,
      systemPrompt: conversation.systemPrompt,
      temperature: conversation.temperature,
      messages: conversation.messages.map(m => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp
      }))
    };
    
    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${conversation.title.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  
  /**
   * Find conversation by ID
   */
  static findConversationById(conversations: Conversation[], id: string): Conversation | undefined {
    return conversations.find(conv => conv.id === id);
  }
  
  /**
   * Sort conversations by date (newest first)
   */
  static sortConversationsByDate(conversations: Conversation[]): Conversation[] {
    return [...conversations].sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }
}