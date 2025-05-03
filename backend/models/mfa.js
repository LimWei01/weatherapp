class MFA {
  constructor(datastore) {
    this.datastore = datastore;
    this.kind = 'MFASecret';
  }


  createKey(userId) {
    return this.datastore.key([this.kind, userId]);
  }


  async generateSecret(userId, secret, qrCodeUrl) {
    const key = this.createKey(userId);
    const entity = {
      key,
      data: {
        userId,
        secret,
        verified: false,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        verificationInProgress: false
      }
    };

    await this.datastore.save(entity);
    return entity.data;
  }


  async getSecret(userId) {
    const key = this.createKey(userId);
    const [entity] = await this.datastore.get(key);
    return entity;
  }

 
  async verifySetup(userId) {
    const key = this.createKey(userId);
    const [entity] = await this.datastore.get(key);
    
    if (!entity) {
      throw new Error('MFA secret not found');
    }

    // Mark as verified
    entity.verified = true;
    entity.updatedAt = new Date();
    entity.verificationInProgress = false;
    
    await this.datastore.save({
      key,
      data: entity
    });

    return entity;
  }

 
  async updateSettings(userId, enabled) {
    const key = this.createKey(userId);
    const [entity] = await this.datastore.get(key);
    
    if (!entity) {
      throw new Error('MFA secret not found');
    }

    entity.enabled = enabled;
    entity.updatedAt = new Date();
    
    await this.datastore.save({
      key,
      data: entity
    });

    return entity;
  }


  async updateVerificationStatus(userId, inProgress) {
    const key = this.createKey(userId);
    let entity;
    
    try {
      [entity] = await this.datastore.get(key);
      
      if (!entity) {
        console.log(`Creating new MFA entry for user ${userId} to track verification status`);
        entity = {
          userId,
          verified: false,
          enabled: true,
          createdAt: new Date(),
          verificationInProgress: inProgress
        };
      } else {
        entity.verificationInProgress = inProgress;
        entity.updatedAt = new Date();
      }
      
      await this.datastore.save({
        key,
        data: entity
      });
      
      return entity;
    } catch (error) {
      console.error(`Error updating MFA verification status for user ${userId}:`, error);
      throw error;
    }
  }

  async deleteSecret(userId) {
    const key = this.createKey(userId);
    await this.datastore.delete(key);
    return { success: true };
  }
}

module.exports = MFA; 