import {
    useLocation,
    useNavigate
} from 'react-router-dom';

const History = {
	navigate: null as any,
	location: null as any,
	push: (page: any) => {
        History.navigate(page);
	},
	loc: () => {
		return History.location.pathname;
	},
};

const NavigateSetter = () => {
	History.navigate = useNavigate();
	History.location = useLocation();
	return null;
};

export { NavigateSetter };

export { History };