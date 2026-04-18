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
    }

    from(table) {
        return new SupabaseQueryBuilder(table, this);
    }
}

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
        
        return await response.json();
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
        
        return await response.json();
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
        
        return await response.json();
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
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        return await response.json();
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