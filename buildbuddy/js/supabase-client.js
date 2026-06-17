// D:\Ijad\Y3S2\FYP\Project\buildbuddy\js\supabase-client.js
import SUPABASE_CONFIG from '../config/config.js';

class SupabaseClient {
    constructor() {
        this.url = SUPABASE_CONFIG.url;
        this.anonKey = SUPABASE_CONFIG.anonKey;
        this.headers = {
            'apikey': this.anonKey,
            'Authorization': `Bearer ${this.anonKey}`,
            'Content-Type': 'application/json'
        };
        
        // Storage API
        this.storage = {
            from: (bucket) => new SupabaseStorageClient(bucket, this)
        };
    }

    from(table) {
        return new SupabaseQueryBuilder(table, this);
    }
}

// ===== STORAGE CLIENT =====
class SupabaseStorageClient {
    constructor(bucket, client) {
        this.bucket = bucket;
        this.client = client;
        this.path = '';
    }

    // Get public URL for a file
    getPublicUrl(path) {
        const url = `${this.client.url}/storage/v1/object/public/${this.bucket}/${path}`;
        return { data: { publicUrl: url } };
    }

    // List files in a folder
    async list(path = '') {
        const url = `${this.client.url}/storage/v1/object/list/${this.bucket}`;
        
        const response = await fetch(url, {
            method: 'POST',  // ✅ Must be POST for listing
            headers: {
                'apikey': this.client.anonKey,
                'Authorization': `Bearer ${this.client.anonKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ prefix: path })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        return { data, error: null };
    }

    // Upload a file
    async upload(path, file, options = {}) {
        const url = `${this.client.url}/storage/v1/object/${this.bucket}/${path}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'apikey': this.client.anonKey,
                'Authorization': `Bearer ${this.client.anonKey}`
            },
            body: file
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        return { data, error: null };
    }

    // Delete a file
    async remove(paths) {
        const url = `${this.client.url}/storage/v1/object/${this.bucket}`;
        
        const response = await fetch(url, {
            method: 'DELETE',
            headers: {
                'apikey': this.client.anonKey,
                'Authorization': `Bearer ${this.client.anonKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(paths)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        return { data, error: null };
    }
}

// ===== QUERY BUILDER =====
class SupabaseQueryBuilder {
    constructor(table, client) {
        this.table = table;
        this.client = client;
        this.selectColumns = '*';
        this.filters = [];
        this.orderByColumn = null;
        this.orderDirection = 'asc';
        this.limitCount = null;
        this.operation = 'select';
        this.updateData = null;
        this.insertData = null;
        this.singleResult = false;
        this.maybeSingleResult = false;
    }

    select(columns = '*') {
        this.selectColumns = columns;
        this.operation = 'select';
        return this;
    }

    eq(column, value) {
        this.filters.push({ column, operator: 'eq', value });
        return this;
    }

    neq(column, value) {
        this.filters.push({ column, operator: 'neq', value });
        return this;
    }

    gt(column, value) {
        this.filters.push({ column, operator: 'gt', value });
        return this;
    }

    lt(column, value) {
        this.filters.push({ column, operator: 'lt', value });
        return this;
    }

    gte(column, value) {
        this.filters.push({ column, operator: 'gte', value });
        return this;
    }

    lte(column, value) {
        this.filters.push({ column, operator: 'lte', value });
        return this;
    }

    like(column, pattern) {
        this.filters.push({ column, operator: 'like', value: pattern });
        return this;
    }

    order(column, direction = 'asc') {
        this.orderByColumn = column;
        this.orderDirection = direction;
        return this;
    }

    limit(count) {
        this.limitCount = count;
        return this;
    }

    single() {
        this.singleResult = true;
        return this;
    }

    maybeSingle() {
        this.maybeSingleResult = true;
        return this;
    }

    insert(data) {
        this.insertData = data;
        this.operation = 'insert';
        return this;
    }

    update(data) {
        this.updateData = data;
        this.operation = 'update';
        return this;
    }

    delete() {
        this.operation = 'delete';
        return this;
    }

    buildSelectUrl() {
        let url = `${this.client.url}/rest/v1/${this.table}?select=${encodeURIComponent(this.selectColumns)}`;
        
        this.filters.forEach(filter => {
            url += `&${filter.column}=${filter.operator}.${encodeURIComponent(filter.value)}`;
        });
        
        if (this.orderByColumn) {
            url += `&order=${this.orderByColumn}.${this.orderDirection}`;
        }
        
        if (this.limitCount) {
            url += `&limit=${this.limitCount}`;
        }
        
        return url;
    }

    buildFilterUrl() {
        let url = `${this.client.url}/rest/v1/${this.table}?`;
        const params = [];
        
        this.filters.forEach(filter => {
            params.push(`${filter.column}=${filter.operator}.${encodeURIComponent(filter.value)}`);
        });
        
        url += params.join('&');
        return url;
    }

    async executeSelect() {
        const url = this.buildSelectUrl();
        
        const response = await fetch(url, {
            method: 'GET',
            headers: this.client.headers
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        
        if (this.singleResult) {
            if (Array.isArray(data) && data.length > 0) {
                return data[0];
            }
            return null;
        }
        
        if (this.maybeSingleResult) {
            if (Array.isArray(data) && data.length > 0) {
                return data[0];
            }
            return null;
        }
        
        return data;
    }

    async executeInsert() {
        const url = `${this.client.url}/rest/v1/${this.table}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                ...this.client.headers,
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(Array.isArray(this.insertData) ? this.insertData : [this.insertData])
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        
        if (this.singleResult) {
            return Array.isArray(data) ? data[0] : data;
        }
        
        return data;
    }

    async executeUpdate() {
        if (this.filters.length === 0) {
            throw new Error('UPDATE requires a WHERE clause. Use .eq() before .update()');
        }
        
        const url = this.buildFilterUrl();
        
        const response = await fetch(url, {
            method: 'PATCH',
            headers: {
                ...this.client.headers,
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(this.updateData)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        
        if (this.singleResult) {
            return Array.isArray(data) ? data[0] : data;
        }
        
        return data;
    }

    async executeDelete() {
        if (this.filters.length === 0) {
            throw new Error('DELETE requires a WHERE clause. Use .eq() before .delete()');
        }
        
        const url = this.buildFilterUrl();
        
        const response = await fetch(url, {
            method: 'DELETE',
            headers: this.client.headers
        });
        
        if (response.status === 204) {
            return { success: true };
        }
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const text = await response.text();
        return text ? JSON.parse(text) : { success: true };
    }

    then(resolve, reject) {
        const execute = async () => {
            try {
                let result;
                
                switch (this.operation) {
                    case 'select':
                        result = await this.executeSelect();
                        break;
                    case 'insert':
                        result = await this.executeInsert();
                        break;
                    case 'update':
                        result = await this.executeUpdate();
                        break;
                    case 'delete':
                        result = await this.executeDelete();
                        break;
                    default:
                        result = await this.executeSelect();
                }
                
                resolve(result);
            } catch (error) {
                console.error('Supabase operation error:', error);
                reject(error);
            }
        };
        
        execute();
    }
}

const supabase = new SupabaseClient();
export default supabase;