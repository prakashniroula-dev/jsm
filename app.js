import {Button, Div, Form, Input, Span, Jsm, useState, useEffect, useMemo, useCallback} from './lib/jsm.js';

const TodoItem = Jsm(({todo, onToggle, onRemove}) => {
  return Div({
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      padding: '10px',
      marginBottom: '6px',
      borderRadius: '8px',
      border: '1px solid #ddd',
      backgroundColor: todo.completed ? '#e4ffe5' : '#ffffff',
      color: todo.completed ? '#4c994c' : '#333'
    }
  },
    Div({style: {display: 'flex', alignItems: 'center', gap: '8px'}},
      Input({
        type: 'checkbox',
        checked: todo.completed,
        onChange: () => onToggle(todo.id)
      }),
      Span({style: {textDecoration: todo.completed ? 'line-through' : 'none'}}, todo.text)
    ),
    Button({
      onClick: () => onRemove(todo.id),
      style: {backgroundColor: '#ff5252', color: 'white', border: 'none', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer'}
    }, 'Remove')
  );
});

const App = Jsm(() => {
  const todos = useState([]);
  const newTodoText = useState('');
  const draftTodo = useState(null);
  const statusMessage = useState('Ready');
  const inputId = useMemo(() => `todo-input-${Date.now()}`, []);

  const allTodos = useMemo(() => {
    if (!draftTodo.value) return todos.value;
    return [...todos.value, draftTodo.value];
  }, [todos, draftTodo]);

  useEffect(() => {
    statusMessage.value = `You have ${allTodos.length} todo${allTodos.length === 1 ? '' : 's'}`;
  }, [allTodos]);

  useEffect(() => {
    const inputNode = document.getElementById(inputId);
    if ( inputNode ) inputNode.focus();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      console.log('Auto-save simulation', new Date().toLocaleTimeString());
    }, 30000);

    return () => clearInterval(timer);
  }, []);

  const activeTodos = useMemo(() => todos.value.filter(t => !t.completed), [todos]);
  const completedTodos = useMemo(() => todos.value.filter(t => t.completed), [todos]);

  const addTodo = useCallback(() => {
    const text = newTodoText.value.trim();
    if (!text) {
      statusMessage.value = 'Type something to add a todo.';
      return;
    }

    const nextTodo = {
      id: Date.now(),
      text,
      completed: false
    };

    todos.value = [...todos.value, nextTodo];
    newTodoText.value = '';
    draftTodo.value = null;
    statusMessage.value = 'Todo added!';
  }, [todos, newTodoText, draftTodo, statusMessage]);

  const toggleTodo = useCallback((id) => {
    if (draftTodo.value && draftTodo.value.id === id) {
      draftTodo.value = {...draftTodo.value, completed: !draftTodo.value.completed};
      return;
    }

    todos.value = todos.value.map(todo =>
      todo.id === id ? {...todo, completed: !todo.completed} : todo
    );
  }, [todos, draftTodo]);

  const clearCompleted = useCallback(() => {
    todos.value = todos.value.filter(todo => !todo.completed);
    if (draftTodo.value && draftTodo.value.completed) {
      draftTodo.value = null;
      newTodoText.value = '';
    }
    statusMessage.value = 'Completed todos cleared';
  }, [todos, draftTodo, newTodoText, statusMessage]);

  return Div({
    style: {
      fontFamily: 'Segoe UI, Arial, sans-serif',
      maxWidth: '700px',
      margin: '32px auto',
      padding: '24px',
      backgroundColor: '#fdfdfd',
      borderRadius: '14px',
      boxShadow: '0 12px 30px rgba(0,0,0,0.08)' 
    }
  },
    Div({style: {display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '14px'}},
      Div({style: {fontSize: '24px', fontWeight: '800'}}, '🗒️ Todo Showcase'),
      Span({style: {fontSize: '14px', color: '#666'}}, statusMessage.value)
    ),

    Form({
      onSubmit: (e) => {
        e.preventDefault();
        addTodo();
      },
      style: {display: 'flex', gap: '10px', marginBottom: '15px'}
    },
      Input({
        id: inputId,
        type: 'text',
        value: newTodoText.value,
        placeholder: 'Enter a new todo',
        onInput: (e) => {
          const value = e.target.value;
          newTodoText.value = value;

          const trimmed = value.trim();
          if (!trimmed) {
            draftTodo.value = null;
            return;
          }

          draftTodo.value = {
            id: 'draft',
            text: value,
            completed: false
          };
        },
        style: {flex: '1', padding: '10px 12px', borderRadius: '8px', border: '1px solid #ccc', outline: 'none'}
      }),
      Button({
        type: 'submit',
        style: {backgroundColor: '#4a90e2', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 16px', cursor: 'pointer'}
      }, 'Add')
    ),

    Div({style: {display: 'flex', gap: '10px', marginBottom: '14px'}},
      Button({
        onClick: () => {
          todos.value = todos.value.map(todo => ({...todo, completed: true}));
          statusMessage.value = 'All marked complete';
        },
        style: {flex: '1', padding: '10px', borderRadius: '8px', border: '1px solid #aaa', cursor: 'pointer'}
      }, 'Complete All'),
      Button({
        onClick: clearCompleted,
        style: {flex: '1', padding: '10px', borderRadius: '8px', border: '1px solid #ff8559', backgroundColor: '#ffece7', cursor: 'pointer'}
      }, `Clear Completed (${completedTodos.length})`)
    ),

    Div({style: {display: 'grid', gap: '8px'}},
      ...allTodos.map(todo =>
        TodoItem({todo, onToggle: toggleTodo, onRemove: (id) => {
          if (draftTodo.value && draftTodo.value.id === id) {
            draftTodo.value = null;
            newTodoText.value = '';
            statusMessage.value = 'Draft todo removed';
            return;
          }

          todos.value = todos.value.filter(item => item.id !== id);
          statusMessage.value = 'Todo removed';
        }})
      )
    ),

    Div({style: {marginTop: '20px', color: '#333', fontSize: '14px'}},
      Span(`Active: ${activeTodos.length}`),
      Span({style: {marginLeft: '18px'}}, `Completed: ${completedTodos.length}`),
      Span({style: {marginLeft: '18px'}}, `Total: ${allTodos.length}`)
    )
  );
});

export default App;