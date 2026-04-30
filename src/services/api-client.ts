/**
 * 通用 HTTP 客户端 — 支持 local/remote 模式切换 + 离线检测
 */

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  meta?: {
    total: number
    page: number
    limit: number
  }
}

export interface ApiClientConfig {
  baseUrl: string
  apiKey?: string
  timeout?: number
}

const DEFAULT_TIMEOUT = 10_000

class ApiClient {
  private config: ApiClientConfig

  constructor(config: ApiClientConfig) {
    this.config = config
  }

  updateConfig(updates: Partial<ApiClientConfig>) {
    this.config = { ...this.config, ...updates }
  }

  get isOnline(): boolean {
    return typeof navigator !== 'undefined' ? navigator.onLine : true
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`
    }
    return headers
  }

  async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<ApiResponse<T>> {
    if (!this.isOnline) {
      return { success: false, error: 'offline' }
    }

    const url = `${this.config.baseUrl}${path}`
    const controller = new AbortController()
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.timeout ?? DEFAULT_TIMEOUT,
    )

    try {
      const response = await fetch(url, {
        method,
        headers: this.buildHeaders(),
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      })

      clearTimeout(timeout)

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText)
        return {
          success: false,
          error: `HTTP ${response.status}: ${errorText}`,
        }
      }

      const data = await response.json() as T
      return { success: true, data }
    } catch (err) {
      clearTimeout(timeout)
      if (err instanceof DOMException && err.name === 'AbortError') {
        return { success: false, error: 'request_timeout' }
      }
      return {
        success: false,
        error: err instanceof Error ? err.message : 'network_error',
      }
    }
  }

  async get<T>(path: string): Promise<ApiResponse<T>> {
    return this.request<T>('GET', path)
  }

  async post<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
    return this.request<T>('POST', path, body)
  }

  async put<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', path, body)
  }

  async delete<T>(path: string): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', path)
  }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

/** 默认 API 客户端实例 */
export const apiClient = new ApiClient({
  baseUrl: API_BASE_URL,
  timeout: DEFAULT_TIMEOUT,
})

export { ApiClient }
