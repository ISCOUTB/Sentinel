from sqlalchemy.orm import Session
from fastapi import HTTPException
from datetime import datetime
from app.models.models import Session as DBSession, SessionState, USV
from typing import Optional

class SessionManager:
    @staticmethod
    def create_session(db: Session, user_id: int, usv_id: int) -> DBSession:
        """
        Transition Inactive -> Preparation.
        Creates a new session for a USV if it is currently inactive.
        """
        # Check if USV exists
        usv = db.query(USV).filter(USV.id == usv_id).first()
        if not usv:
            raise HTTPException(status_code=404, detail="USV not found")

        # Check if USV is already in an active session (Preparation, Active, Mission)
        active_session = db.query(DBSession).filter(
            DBSession.usv_id == usv_id,
            DBSession.state.in_([SessionState.PREPARATION, SessionState.ACTIVE, SessionState.MISSION])
        ).first()

        if active_session:
            raise HTTPException(status_code=400, detail="USV is already in an active session")

        # Create new session in Preparation state
        new_session = DBSession(
            user_id=user_id,
            usv_id=usv_id,
            state=SessionState.PREPARATION,
            started_at=datetime.utcnow()
        )
        db.add(new_session)
        db.commit()
        db.refresh(new_session)
        return new_session

    @staticmethod
    def start_session(db: Session, session_id: int, user_id: int) -> DBSession:
        """
        Transition Preparation -> Active.
        """
        session = db.query(DBSession).filter(DBSession.id == session_id, DBSession.user_id == user_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        if session.state != SessionState.PREPARATION:
            raise HTTPException(status_code=400, detail=f"Cannot transition to Active from {session.state}")

        session.state = SessionState.ACTIVE
        db.commit()
        db.refresh(session)
        return session

    @staticmethod
    def start_mission(db: Session, session_id: int, user_id: int) -> DBSession:
        """
        Transition Active -> Mission.
        """
        session = db.query(DBSession).filter(DBSession.id == session_id, DBSession.user_id == user_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        if session.state != SessionState.ACTIVE:
            raise HTTPException(status_code=400, detail=f"Cannot transition to Mission from {session.state}")

        session.state = SessionState.MISSION
        db.commit()
        db.refresh(session)
        return session

    @staticmethod
    def stop_mission(db: Session, session_id: int, user_id: int) -> DBSession:
        """
        Transition Mission -> Active.
        """
        session = db.query(DBSession).filter(DBSession.id == session_id, DBSession.user_id == user_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        if session.state != SessionState.MISSION:
            raise HTTPException(status_code=400, detail=f"Cannot transition from {session.state}")

        session.state = SessionState.ACTIVE
        db.commit()
        db.refresh(session)
        return session

    @staticmethod
    def end_session(db: Session, session_id: int, user_id: int) -> DBSession:
        """
        Transition Active/Preparation -> Inactive (ends session).
        NOTE: Validating 'Safe_Point' via telemtry in InfluxDB should be done before calling this, 
        or integrated within this method depending on architecture.
        """
        session = db.query(DBSession).filter(DBSession.id == session_id, DBSession.user_id == user_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        if session.state not in [SessionState.PREPARATION, SessionState.ACTIVE]:
            raise HTTPException(status_code=400, detail=f"Cannot end session from state: {session.state}")

        # In a real scenario, check InfluxDB telemetry to ensure USV is physically at Safe_Point
        # For now, we transition to INACTIVE.
        session.state = SessionState.INACTIVE
        session.ended_at = datetime.utcnow()
        db.commit()
        db.refresh(session)
        return session

    @staticmethod
    def get_active_session_for_user(db: Session, user_id: int) -> Optional[DBSession]:
        return db.query(DBSession).filter(
            DBSession.user_id == user_id,
            DBSession.state.in_([SessionState.PREPARATION, SessionState.ACTIVE, SessionState.MISSION])
        ).first()

    @staticmethod
    def get_available_usvs(db: Session):
        """Returns USVs that are not currently in an active session."""
        active_session_usv_ids = db.query(DBSession.usv_id).filter(
            DBSession.state.in_([SessionState.PREPARATION, SessionState.ACTIVE, SessionState.MISSION])
        )
        return db.query(USV).filter(USV.id.notin_(active_session_usv_ids)).all()
